import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LanguageConfig, SessionStatus, ChatMessage } from '../types';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';

// Constants for audio settings
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
// We'll use a specific buffer size for the worklet to match the chunking behavior
const BUFFER_SIZE = 4096;

// AudioWorklet processor code embedded as a string to avoid external file loading issues in build
const WORKLET_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = ${BUFFER_SIZE};
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0];
      
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bytesWritten] = channelData[i];
        this.bytesWritten++;

        if (this.bytesWritten >= this.bufferSize) {
          // Send the buffer to the main thread
          this.port.postMessage(this.buffer);
          this.bytesWritten = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

// Helper to clean up template literals
const cleanPrompt = (text: string) => {
  return text.replace(/\s+/g, ' ').trim();
};

export const useGeminiLive = (config: LanguageConfig | null) => {
  const [status, setStatus] = useState<SessionStatus>(SessionStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  
  // Refs for audio handling
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Refs for Transcription Handling
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');
  
  const cleanup = useCallback(() => {
    // Stop all playing audio
    audioSourcesRef.current.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.port.onmessage = null;
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

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
    setMessages([]);
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
    nextStartTimeRef.current = 0;
    setCurrentVolume(0);
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
    // Specialized instruction for Translator mode
    if (config.mode === 'translator') {
      return cleanPrompt(`
          SYSTEM INSTRUCTION: SIMULTANEOUS INTERPRETER.
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
        `);
    }

    const difficultyRules = getDifficultyInstruction(config);
    let modeInstruction = '';
    
    switch (config.mode) {
      case 'reconstruction':
        modeInstruction = `
          MODE: UPGRADE MY SENTENCE (Drill Mode).
          YOUR ROLE: You are a strict but helpful diction coach.
          THE LOOP:
          1. Wait for the user to say a phrase or sentence (even a broken one).
          2. Identify the intended meaning.
          3. Generate the "Ideal Native Version" suitable for the user's selected difficulty level.
          4. Say: "Try this: [Insert Ideal Version]".
          5. Wait for the user to repeat it.
          6. If they repeat correctly, say "Perfect" and ask for the next thought.
          7. If they repeat poorly, emphasize the specific word they missed and ask them to try again.
          NOTE: Keep explanations to absolute minimum. Focus on repetition and muscle memory.
        `;
        break;
      
      case 'critical_thinking':
        modeInstruction = `
          MODE: CRITICAL THINKING / DEBATE.
          TOPIC: "${config.topicOrWords || 'General Philosophy'}".
          YOUR ROLE: Socratic Challenger & Devil's Advocate.
          INTERACTION RULES:
          1. Take a controversial or opposing stance to whatever the user says about the topic.
          2. Use the Socratic Method: Ask "Why?", "How do you know?", "What about...?"
          3. Challenge logical fallacies.
          4. DO NOT accept "I don't know" or short answers. Push the user to elaborate.
          5. While they argue, silently track their language mistakes. After they finish a point, briefly correct ONE major error, then immediately fire the next counter-argument.
          GOAL: Force the user to construct complex arguments under pressure.
        `;
        break;

      case 'interview':
        modeInstruction = `
          MODE: JOB INTERVIEW / SCENARIO SIMULATION.
          CONTEXT: "${config.topicOrWords || 'General Job Interview'}".
          YOUR ROLE: Professional Interviewer or Scenario Actor.
          INTERACTION RULES:
          1. Conduct a realistic roleplay based on the Context.
          2. Ask relevant, probing questions one by one.
          3. If the user makes a significant mistake (grammar/cultural), briefly step out of character to correct it using [Square Brackets], then immediately resume character.
          4. Maintain the professional demeanor appropriate for the scenario.
        `;
        break;

      case 'free_chat':
      default:
        modeInstruction = `
          MODE: FREE CONVERSATION.
          YOUR ROLE: Engaging Conversationalist & Guide.
          INTERACTION RULES:
          1. Ask open-ended questions (Who, What, Where, When, Why) to keep the user talking.
          2. Apply the "80/20 Rule": The user should speak 80% of the time.
          3. If the conversation stalls, introduce a culturally relevant topic regarding ${config.targetLanguage} culture.
          4. Correction Policy: adhere strictly to the Difficulty Level settings defined above.
        `;
        break;
    }

    return `${difficultyRules} ${cleanPrompt(modeInstruction)}`;
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

      // Ensure contexts are resumed (vital for some browsers)
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      // Setup AudioWorklet
      const blob = new Blob([WORKLET_CODE], { type: "application/javascript" });
      const workletUrl = URL.createObjectURL(blob);
      await inputAudioContextRef.current.audioWorklet.addModule(workletUrl);

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
            inputSourceRef.current = source;
            
            // Analyser for volume visualization (Parallel to worklet)
            const analyser = inputAudioContextRef.current.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            // Worklet for PCM processing
            const workletNode = new AudioWorkletNode(inputAudioContextRef.current, 'pcm-processor');
            workletNodeRef.current = workletNode;
            
            workletNode.port.onmessage = (event) => {
              const inputData = event.data; // Float32Array from worklet
              
              // Volume calc (Visualization)
              if (analyserRef.current) {
                const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
                analyserRef.current.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setCurrentVolume(avg);
              }

              // Send to Gemini
              if (sessionPromiseRef.current) {
                 const pcmBlob = createPcmBlob(inputData);
                 sessionPromiseRef.current.then((session: any) => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (e) {
                    console.error("Error sending input", e);
                  }
                });
              }
            };

            source.connect(workletNode);
            workletNode.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Handle Audio
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

            // 2. Handle Transcription
            // Accumulate input (User)
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputTranscriptionRef.current += text;
              
              setMessages(prev => {
                const existing = prev.filter(m => m.id !== 'temp-user');
                return [...existing, {
                  id: 'temp-user',
                  role: 'user',
                  text: currentInputTranscriptionRef.current,
                  isFinal: false
                }];
              });
            }

            // Accumulate output (Model)
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputTranscriptionRef.current += text;

              setMessages(prev => {
                const existing = prev.filter(m => m.id !== 'temp-model');
                return [...existing, {
                  id: 'temp-model',
                  role: 'model',
                  text: currentOutputTranscriptionRef.current,
                  isFinal: false
                }];
              });
            }

            // 3. Handle Turn Complete (Solidify transcripts)
            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscriptionRef.current.trim();
              const modelText = currentOutputTranscriptionRef.current.trim();
              
              setMessages(prev => {
                const history = prev.filter(m => !m.id.startsWith('temp-'));
                const newHistory = [...history];

                if (userText) {
                  newHistory.push({
                    id: Date.now() + '-user',
                    role: 'user',
                    text: userText,
                    isFinal: true
                  });
                }
                
                if (modelText) {
                  newHistory.push({
                    id: Date.now() + '-model',
                    role: 'model',
                    text: modelText,
                    isFinal: true
                  });
                }
                return newHistory;
              });

              currentInputTranscriptionRef.current = '';
              currentOutputTranscriptionRef.current = '';
            }

            // 4. Handle Interruptions
            if (message.serverContent?.interrupted) {
              console.log("Interrupted - clearing audio queue");
              audioSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch(e) {}
              });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = outputAudioContextRef.current?.currentTime || 0;
              
              const modelText = currentOutputTranscriptionRef.current.trim();
              if (modelText) {
                 setMessages(prev => {
                    const history = prev.filter(m => !m.id.startsWith('temp-'));
                    return [...history, {
                      id: Date.now() + '-model-interrupted',
                      role: 'model',
                      text: modelText + '...',
                      isFinal: true
                    }];
                 });
              }
              currentOutputTranscriptionRef.current = '';
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
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: { parts: [{ text: systemInstructionText }] },
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
    currentVolume
  };
};