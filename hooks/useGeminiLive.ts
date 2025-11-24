import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LanguageConfig, SessionStatus } from '../types';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';

// Constants for audio settings
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

export const useGeminiLive = (config: LanguageConfig | null) => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Refs for audio handling to avoid re-renders
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    // Stop all playing audio
    audioSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();

    // Close contexts
    if (inputAudioContextRef.current?.state !== 'closed') {
      inputAudioContextRef.current?.close();
    }
    if (outputAudioContextRef.current?.state !== 'closed') {
      outputAudioContextRef.current?.close();
    }
    
    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Close session if possible
    sessionPromiseRef.current = null;
    
    setStatus(SessionStatus.IDLE);
    nextStartTimeRef.current = 0;
  }, []);

  const getDifficultyInstruction = (config: LanguageConfig) => {
    const base = `
      ROLE: You are an expert Language Tutor specialized in immersion learning.
      TARGET LANGUAGE: ${config.targetLanguage}.
      USER NATIVE LANGUAGE: ${config.nativeLanguage}.
      
      CORE BEHAVIOR:
      - Concise Responses: Keep your turns short (max 2-3 sentences) to let the user practice.
      - Active Listening: Acknowledge what the user said before correcting or moving on.
    `;

    switch (config.difficulty) {
      case 'beginner':
        return `${base}
          PROFICIENCY LEVEL: BEGINNER (A1/A2)
          
          PEDAGOGY:
          1. SPEECH SPEED: Speak EXTREMELY SLOWLY and clearly. Enunciate every syllable.
          2. VOCABULARY: Limit to the "Top 500 Most Common Words". Avoid idioms completely.
          3. GRAMMAR: Stick to Present Simple and basic Past tense.
          4. CORRECTION STYLE: "Supportive Sandwich".
             - First, understand what they tried to say.
             - Gently correct the mistake in ${config.targetLanguage}.
             - IF they struggle, explain briefly in ${config.nativeLanguage}, then immediately revert to ${config.targetLanguage}.
          5. GOAL: Build confidence. Accept broken sentences if the meaning is clear, but model the correct version.
        `;
      case 'intermediate':
        return `${base}
          PROFICIENCY LEVEL: INTERMEDIATE (B1/B2)
          
          PEDAGOGY:
          1. SPEECH SPEED: Moderate, deliberate pace. Clear but not robotic.
          2. VOCABULARY: Standard daily vocabulary. Introduce one new word per turn if relevant.
          3. GRAMMAR: Use mixed tenses.
          4. CORRECTION STYLE: "Flow Maintenance".
             - Do not interrupt for minor errors that don't affect meaning.
             - Correct major grammar errors (conjugations, gender, word order) by repeating the user's sentence correctly.
             - Explain complex errors in ${config.nativeLanguage} ONLY if the user is confused.
          5. GOAL: Fluidity. Get them to speak longer paragraphs.
        `;
      case 'advanced':
        return `${base}
          PROFICIENCY LEVEL: ADVANCED (C1)
          
          PEDAGOGY:
          1. SPEECH SPEED: Natural, native speed.
          2. VOCABULARY: Use rich adjectives, precise verbs, and common idioms.
          3. CORRECTION STYLE: "The Polisher".
             - Focus on phrasing that is grammatically correct but "sounds foreign".
             - Suggest synonyms to make them sound more sophisticated.
             - NO ${config.nativeLanguage} allowed unless explicitly requested for a translation.
          4. GOAL: Nuance and Precision.
        `;
      case 'native':
        return `${base}
          PROFICIENCY LEVEL: NATIVE MASTERY (C2)
          
          PEDAGOGY:
          1. SPEECH SPEED: Fast, fluid, with contractions, connected speech, and emotional intonation.
          2. VOCABULARY: Use slang, cultural references, humor, and complex sentence structures.
          3. CORRECTION STYLE: "Peer Review".
             - Only correct accent, intonation, or cultural inappropriateness.
             - Treat the user as a peer, not a student. 
             - Ruthlessly eliminate any "textbook" sounding phrases.
          4. GOAL: Cultural Integration and Accent Reduction.
        `;
      default:
        return base;
    }
  };

  const getSystemInstruction = (config: LanguageConfig) => {
    // Specialized instruction for Translator mode
    if (config.mode === 'translator') {
      return `
          SYSTEM INSTRUCTION: SIMULTANEOUS INTERPRETER
          
          SOURCE/TARGET LANGUAGES: ${config.nativeLanguage} <-> ${config.targetLanguage}.

          STRICT PROTOCOL:
          1. Listen strictly.
          2. Detect language automatically.
          3. Translate the full meaning instantly to the other language.
          4. Maintain the tone (formal, angry, happy) of the speaker.
          
          OUTPUT RULES:
          - DO NOT add "Here is the translation". Just speak the translation.
          - DO NOT explain the grammar.
          - DO NOT engage in conversation.
          - If the audio is unclear, ask "Please repeat" in the target language.
        `;
    }

    const difficultyRules = getDifficultyInstruction(config);
    
    switch (config.mode) {
      case 'reconstruction':
        return `
          ${difficultyRules}
          MODE: UPGRADE MY SENTENCE (Drill Mode).
          
          YOUR ROLE: You are a strict but helpful diction coach.
          
          THE LOOP:
          1.  Wait for the user to say a phrase or sentence (even a broken one).
          2.  Identify the intended meaning.
          3.  Generate the "Ideal Native Version" suitable for the user's selected difficulty level.
          4.  Say: "Try this: [Insert Ideal Version]".
          5.  Wait for the user to repeat it.
          6.  If they repeat correctly, say "Perfect" and ask for the next thought.
          7.  If they repeat poorly, emphasize the specific word they missed and ask them to try again.
          
          NOTE: Keep explanations to absolute minimum. Focus on repetition and muscle memory.
        `;
      
      case 'critical_thinking':
        return `
          ${difficultyRules}
          MODE: CRITICAL THINKING / DEBATE.
          TOPIC: "${config.topicOrWords || 'General Philosophy'}".
          
          YOUR ROLE: Socratic Challenger & Devil's Advocate.
          
          INTERACTION RULES:
          1.  Take a controversial or opposing stance to whatever the user says about the topic.
          2.  Use the Socratic Method: Ask "Why?", "How do you know?", "What about...?"
          3.  Challenge logical fallacies.
          4.  DO NOT accept "I don't know" or short answers. Push the user to elaborate.
          5.  While they argue, silently track their language mistakes. After they finish a point, briefly correct ONE major error, then immediately fire the next counter-argument.
          
          GOAL: Force the user to construct complex arguments under pressure.
        `;

      case 'free_chat':
      default:
        return `
          ${difficultyRules}
          MODE: FREE CONVERSATION.
          
          YOUR ROLE: Engaging Conversationalist & Guide.
          
          INTERACTION RULES:
          1.  Ask open-ended questions (Who, What, Where, When, Why) to keep the user talking.
          2.  Apply the "80/20 Rule": The user should speak 80% of the time.
          3.  If the conversation stalls, introduce a culturally relevant topic regarding ${config.targetLanguage} culture.
          4.  Correction Policy: adhere strictly to the Difficulty Level settings defined above.
        `;
    }
  };

  const connect = useCallback(async () => {
    if (!config) return;
    
    try {
      setStatus(SessionStatus.CONNECTING);
      setErrorMessage('');

      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found. Please check your settings.");
      }

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: INPUT_SAMPLE_RATE });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });

      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = getSystemInstruction(config);

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setStatus(SessionStatus.CONNECTED);

            if (!inputAudioContextRef.current || !streamRef.current) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
            const processor = inputAudioContextRef.current.createScriptProcessor(BUFFER_SIZE, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session: any) => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (e) {
                    console.error("Error sending input", e);
                  }
                });
              }
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            
            inputSourceRef.current = source;
            scriptProcessorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            // Safe access to audio data
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
              try {
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  outputAudioContextRef.current.currentTime
                );

                const audioData = base64ToBytes(base64Audio);
                const audioBuffer = await decodeAudioData(
                  audioData, 
                  outputAudioContextRef.current, 
                  OUTPUT_SAMPLE_RATE, 
                  1
                );

                const source = outputAudioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                
                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
              } catch (e) {
                console.error("Error decoding audio", e);
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted - clearing audio queue");
              audioSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch(e) {}
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
            }
          },
          onclose: () => {
            console.log("Gemini Live Closed");
            setStatus(SessionStatus.IDLE);
          },
          onerror: (err) => {
            console.error("Gemini Live Error", err);
            setErrorMessage("Connection error. Please try again.");
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          },
          systemInstruction: systemInstruction,
        }
      });

    } catch (error: any) {
      console.error("Connection setup failed", error);
      setErrorMessage(error.message || "Failed to access microphone or connect.");
      setStatus(SessionStatus.ERROR);
      cleanup();
    }
  }, [config, cleanup]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    status,
    connect,
    disconnect: cleanup,
    errorMessage
  };
};
