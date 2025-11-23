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

  const connect = useCallback(async () => {
    if (!config) return;
    
    try {
      setStatus(SessionStatus.CONNECTING);
      setErrorMessage('');

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: INPUT_SAMPLE_RATE });
      outputAudioContextRef.current = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });

      // Vital: Resume contexts immediately in case they are suspended by browser policy
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      const outputNode = outputAudioContextRef.current.createGain();
      outputNode.connect(outputAudioContextRef.current.destination);

      // Get Microphone Access
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Build System Instruction based on user config
      const systemInstruction = `
        Role: You are "SpeakToMe", a highly intelligent, native-level language tutor and conversation partner.
        Context: The user speaks ${config.nativeLanguage} and wants to practice ${config.targetLanguage}.
        
        Core Behaviors:
        1. **Adaptability**: Instantly analyze the user's proficiency. If they speak slowly or simply, match that pace. If they are fluent, speak at a normal, rapid native pace.
        2. **Slang & Colloquialisms**: You understand street slang, idioms, and cultural references in both ${config.nativeLanguage} and ${config.targetLanguage}. If the user uses a slang term in ${config.nativeLanguage}, teach them the cool/natural equivalent in ${config.targetLanguage}.
        3. **Correction Style**: Do NOT lecture. If the user makes a mistake, rephrase it correctly in your reply naturally (implicit correction). Only stop to explain if the error causes confusion.
        4. **Personality**: You are NOT an AI assistant. You are a friend. Do not ask "How can I help?". Start with a casual opener like "Hey! So, what's on your mind today?" or "Ready to chat? What's new?".
        5. **Engagement**: Keep the conversation flowing. Ask follow-up questions. Be curious about their life.

        Objective: Maximize the user's speaking confidence and listening comprehension in ${config.targetLanguage}.
      `;

      // Connect to Live API
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            setStatus(SessionStatus.CONNECTED);

            // Setup Input Audio Processing
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
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            
            if (base64Audio && outputAudioContextRef.current) {
              // Sync start time
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

            // Handle Interruptions
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