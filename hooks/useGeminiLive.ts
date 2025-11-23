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

  const getSystemInstruction = (config: LanguageConfig) => {
    const commonRules = `
      - User's Native Language: ${config.nativeLanguage}
      - Target Language: ${config.targetLanguage}
      - If the user makes a pronunciation/grammar mistake, PAUSE and explain it in ${config.nativeLanguage}, then ask them to repeat correctly in ${config.targetLanguage}.
    `;

    switch (config.mode) {
      case 'reconstruction':
        return `
          Role: Advanced Language Refiner.
          Task: 
          1. Listen to the user's sentence (which might be basic or incorrect).
          2. Do NOT just continue the conversation.
          3. Instead, say: "Here is a better/native way to say that:" and provide a C1/C2 advanced version of what they tried to say, using better vocabulary and idioms.
          4. Ask the user to repeat the advanced version.
          5. Once they repeat, confirm if it was good, then ask the next question to keep the flow.
          ${commonRules}
        `;
      
      case 'critical_thinking':
        return `
          Role: Critical Thinking Debate Partner.
          Context/Words to use: "${config.topicOrWords || 'General Philosophy'}".
          Task:
          1. Start by creating a short, interesting, slightly controversial scenario or story using the Context/Words provided above.
          2. Ask the user DEEP "Why", "How", or "What if" questions about it.
          3. Do NOT accept simple answers. Force the user to argue their point.
          4. If they give a short answer, ask: "Can you explain why you think that in more detail?"
          ${commonRules}
        `;

      case 'translator':
        return `
          Role: Strict Live Translator & Pronunciation Coach.
          Task:
          1. The user will speak in ${config.nativeLanguage}.
          2. You must immediately translate what they said into ${config.targetLanguage} with perfect accent and intonation.
          3. Then, ask the user to repeat the ${config.targetLanguage} phrase.
          4. Listen strictly to their repetition. If it's bad, correct them in ${config.nativeLanguage}.
          5. If they speak ${config.targetLanguage} initially, just correct them if needed.
        `;

      case 'free_chat':
      default:
        return `
          Role: Strict Bilingual Tutor.
          Rules:
          1. Start and maintain conversation in ${config.targetLanguage}.
          2. Be very strict about pronunciation and grammar.
          3. Explain mistakes in ${config.nativeLanguage} clearly.
          4. Make the user repeat correctly before moving on.
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
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
            
            inputSourceRef.current = source;
            scriptProcessorRef.current = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
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