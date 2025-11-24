import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LanguageConfig, SessionStatus, ChatMessage } from '../types';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';

// Constants
const OUTPUT_SAMPLE_RATE = 24000;
// We no longer force INPUT_SAMPLE_RATE. We use the system default to avoid production errors.
const BUFFER_SIZE = 4096;

// Helper to clean up template literals and remove extra whitespace/newlines
const cleanPrompt = (text: string) => {
  return text.replace(/\s+/g, ' ').trim();
};

export const useGeminiLive = (config: LanguageConfig | null) => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
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
    const base = cleanPrompt(`
      ROLE: You are an expert Language Tutor specialized in immersion learning.
      TARGET LANGUAGE: ${config.targetLanguage}.
      USER NATIVE LANGUAGE: ${config.nativeLanguage}.
      CORE BEHAVIOR:
      - Concise Responses: Keep your turns short (max 2-3 sentences) to let the user practice.
      - Active Listening: Acknowledge what the user said before correcting or moving on.
    `);

    let specific = '';

    switch (config.difficulty) {
      case 'beginner':
        specific = `
          PROFICIENCY LEVEL: BEGINNER (A1/A2).
          PEDAGOGY:
          1. SPEECH SPEED: Speak EXTREMELY SLOWLY and clearly. Enunciate every syllable.
          2. VOCABULARY: Limit to the "Top 500 Most Common Words". Avoid idioms completely.
          3. GRAMMAR: Stick to Present Simple and basic Past tense.
          4. CORRECTION STYLE: "Supportive Sandwich". First, understand what they tried to say. Gently correct the mistake in ${config.targetLanguage}. IF they struggle, explain briefly in ${config.nativeLanguage}, then immediately revert to ${config.targetLanguage}.
          5. GOAL: Build confidence. Accept broken sentences if the meaning is clear, but model the correct version.
        `;
        break;
      case 'intermediate':
        specific = `
          PROFICIENCY LEVEL: INTERMEDIATE (B1/B2).
          PEDAGOGY:
          1. SPEECH SPEED: Moderate, deliberate pace. Clear but not robotic.
          2. VOCABULARY: Standard daily vocabulary. Introduce one new word per turn if relevant.
          3. GRAMMAR: Use mixed tenses.
          4. CORRECTION STYLE: "Flow Maintenance". Do not interrupt for minor errors that don't affect meaning. Correct major grammar errors (conjugations, gender, word order) by repeating the user's sentence correctly. Explain complex errors in ${config.nativeLanguage} ONLY if the user is confused.
          5. GOAL: Fluidity. Get them to speak longer paragraphs.
        `;
        break;
      case 'advanced':
        specific = `
          PROFICIENCY LEVEL: ADVANCED (C1).
          PEDAGOGY:
          1. SPEECH SPEED: Natural, native speed.
          2. VOCABULARY: Use rich adjectives, precise verbs, and common idioms.
          3. CORRECTION STYLE: "The Polisher". Focus on phrasing that is grammatically correct but "sounds foreign". Suggest synonyms to make them sound more sophisticated. NO ${config.nativeLanguage} allowed unless explicitly requested for a translation.
          4. GOAL: Nuance and Precision.
        `;
        break;
      case 'native':
        specific = `
          PROFICIENCY LEVEL: NATIVE MASTERY (C2).
          PEDAGOGY:
          1. SPEECH SPEED: Fast, fluid, with contractions, connected speech, and emotional intonation.
          2. VOCABULARY: Use slang, cultural references, humor, and complex sentence structures.
          3. CORRECTION STYLE: "Peer Review". Only correct accent, intonation, or cultural inappropriateness. Treat the user as a peer, not a student. Ruthlessly eliminate any "textbook" sounding phrases.
          4. GOAL: Cultural Integration and Accent Reduction.
        `;
        break;
    }

    return `${base} ${cleanPrompt(specific)}`;
  };

  const getSystemInstruction = (config: LanguageConfig) => {
    if (config.mode === 'translator') {
      return cleanPrompt(`
          SYSTEM INSTRUCTION: SIMULTANEOUS INTERPRETER.
          SOURCE/TARGET LANGUAGES: ${config.nativeLanguage} <-> ${config.targetLanguage}.
          STRICT PROTOCOL:
          1. Listen strictly.
          2. Detect language automatically.
          3. Translate the full meaning instantly to the other language.
          4. Maintain the tone.
          OUTPUT RULES:
          - Just speak the translation.
          - NO explanations.
        `);
    }

    const difficultyRules = getDifficultyInstruction(config);
    let modeInstruction = '';
    
    switch (config.mode) {
      case 'reconstruction':
        modeInstruction = `
          MODE: UPGRADE MY SENTENCE.
          ROLE: Diction coach.
          LOOP: Wait for user phrase -> Identify meaning -> Generate Ideal Native Version -> Ask user to try "Ideal Version" -> Verify repetition.
          Keep explanations minimal.
        `;
        break;
      
      case 'critical_thinking':
        modeInstruction = `
          MODE: DEBATE.
          TOPIC: "${config.topicOrWords || 'Philosophy'}".
          ROLE: Devil's Advocate.
          RULES: Challenge user stances. Use Socratic method. Correct one error per turn.
        `;
        break;

      case 'free_chat':
      default:
        modeInstruction = `
          MODE: FREE CONVERSATION.
          RULES: Ask open-ended questions. User speaks 80%.
        `;
        break;
    }

    return `${difficultyRules} ${cleanPrompt(modeInstruction)}`;
  };

  const sendTextMessage = useCallback((text: string) => {
    if (!sessionPromiseRef.current) return;
    
    // Optimistically add user message to UI
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      isFinal: true,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);

    sessionPromiseRef.current.then((session: any) => {
      try {
        // Safe check for the send method
        if (typeof session.send === 'function') {
          session.send([{ text: text }], true);
        } else {
          console.warn("Text sending is not supported in this version of the Live API.");
        }
      } catch (e) {
        console.error("Error sending text", e);
      }
    });
  }, []);

  const connect = useCallback(async () => {
    if (!config) return;
    
    try {
      setStatus(SessionStatus.CONNECTING);
      setErrorMessage('');
      setMessages([]);

      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API Key not found.");
      }

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // INPUT: Let browser decide sample rate (avoids errors on some hardware)
      inputAudioContextRef.current = new AudioContextClass();
      const inputSampleRate = inputAudioContextRef.current.sampleRate;

      // OUTPUT: Gemini usually returns 24000Hz.
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
      
      const systemInstructionText = getSystemInstruction(config);
      
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
              // Pass the ACTUAL hardware sample rate to the blob creator
              const pcmBlob = createPcmBlob(inputData, inputSampleRate);
              
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
            const timestamp = Date.now();

            // --- Handle Transcription ---
            let textUpdate = '';
            let role: 'user' | 'model' | null = null;

            // Check for serverContent transcription (Model)
            if (message.serverContent?.outputTranscription) {
              textUpdate = message.serverContent.outputTranscription.text;
              role = 'model';
            } 
            // Check for serverContent transcription (User) - this confirms the model heard us
            else if (message.serverContent?.inputTranscription) {
              textUpdate = message.serverContent.inputTranscription.text;
              role = 'user';
            }

            if (role && textUpdate) {
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                
                // Append to existing message if role matches and it's not final
                if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
                  const updatedMsg = { ...lastMsg, text: lastMsg.text + textUpdate };
                  return [...prev.slice(0, -1), updatedMsg];
                } 
                
                // Don't create empty messages
                if (!textUpdate.trim()) return prev;

                return [...prev, {
                  id: timestamp.toString(),
                  role: role!,
                  text: textUpdate,
                  isFinal: false,
                  timestamp
                }];
              });
            }

            // Mark messages as final
            if (message.serverContent?.turnComplete || message.serverContent?.interrupted) {
              setMessages(prev => prev.map(m => ({ ...m, isFinal: true })));
            }

            // --- Handle Audio Output ---
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
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          },
          systemInstruction: systemInstructionText,
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
    errorMessage,
    messages,
    sendTextMessage
  };
};