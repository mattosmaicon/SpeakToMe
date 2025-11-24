import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { LanguageConfig, SessionStatus, ChatMessage } from '../types';
import { createPcmBlob, base64ToBytes, decodeAudioData } from '../utils/audioUtils';

// Constants for audio settings
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const BUFFER_SIZE = 4096;

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

  // Refs for transcription accumulation
  const currentInputTranscriptionRef = useRef<string>('');
  const currentOutputTranscriptionRef = useRef<string>('');

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
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
  }, []);

  const getDifficultyInstruction = (config: LanguageConfig) => {
    switch (config.difficulty) {
      case 'beginner':
        return `
          ADAPTATION LEVEL: BEGINNER (A1/A2).
          - SPEAKING PACE: Very slow and articulate. Enunciate every word clearly.
          - VOCABULARY: Use very simple, high-frequency words. Avoid idioms.
          - SENTENCE STRUCTURE: Short, simple sentences (Subject-Verb-Object).
          - ATTITUDE: Extremely patient and encouraging.
          - CORRECTIONS: Only correct major errors that block understanding. Explain very simply in ${config.nativeLanguage}.
        `;
      case 'intermediate':
        return `
          ADAPTATION LEVEL: INTERMEDIATE (B1/B2).
          - SPEAKING PACE: Moderate/Standard speed.
          - VOCABULARY: Common standard vocabulary. Introduce some new words but explain them.
          - SENTENCE STRUCTURE: Standard compound sentences.
          - ATTITUDE: Supportive but challenging.
          - CORRECTIONS: Correct grammatical errors and pronunciation issues.
        `;
      case 'advanced':
        return `
          ADAPTATION LEVEL: ADVANCED (C1).
          - SPEAKING PACE: Natural, native speed.
          - VOCABULARY: Rich vocabulary, including some idioms and nuanced terms.
          - SENTENCE STRUCTURE: Complex and varied.
          - ATTITUDE: Professional and intellectual.
          - CORRECTIONS: Strict. Correct subtle unnatural phrasing.
        `;
      case 'native':
        return `
          ADAPTATION LEVEL: NATIVE MASTERY (C2).
          - SPEAKING PACE: Fast, natural, fluid (like talking to a friend).
          - VOCABULARY: Full range of idioms, slang, and cultural references.
          - ATTITUDE: Talk as an equal peer.
          - CORRECTIONS: Only correct if the user sounds non-native. Push for perfect accent and flow.
        `;
      default:
        return '';
    }
  };

  const getSystemInstruction = (config: LanguageConfig) => {
    // For translator mode, we skip difficulty logic to keep it purely mechanical
    if (config.mode === 'translator') {
      return `
          SYSTEM INSTRUCTION: PROFESSIONAL BIDIRECTIONAL INTERPRETER
          
          LANGUAGES: ${config.nativeLanguage} AND ${config.targetLanguage}.

          TASK:
          You are a professional simultaneous interpreter. You translate spoken text between the two languages above.

          PROTOCOL:
          1. LISTEN to the input audio.
          2. DETECT the language automatically.
             - IF Input is ${config.nativeLanguage} -> TRANSLATE directly to ${config.targetLanguage}.
             - IF Input is ${config.targetLanguage} -> TRANSLATE directly to ${config.nativeLanguage}.
          3. Output ONLY the translation.

          TRANSLATION GUIDELINES:
          - NATURALNESS FIRST: Prioritize the natural meaning and flow over literal word-for-word translation. The output must sound like a native speaker of the target language.
          - LOANWORDS: Preserve foreign words that are commonly used and accepted in the target language (e.g., "feedback", "software", "marketing", "online", "design") if they fit naturally in the context. Only translate these terms if the native equivalent is clearer or more idiomatic in that specific sentence.
          - TONE: Match the tone and register of the speaker (formal/informal).

          STRICT PROHIBITIONS:
          - DO NOT answer questions or engage in conversation.
          - DO NOT provide explanations, corrections, or meta-commentary (e.g., never say "in English this means...").
          - DO NOT hallucinate content.

          Your goal is to be an invisible, high-quality bridge between the languages.
        `;
    }

    const difficultyRules = getDifficultyInstruction(config);
    
    const commonRules = `
      - User's Native Language: ${config.nativeLanguage}
      - Target Language: ${config.targetLanguage}
      
      IMPORTANT - FOLLOW THIS DIFFICULTY SETTING:
      ${difficultyRules}

      GENERAL PROTOCOL:
      - If the user makes a pronunciation/grammar mistake that fits the Correction criteria above, PAUSE and explain it in ${config.nativeLanguage}, then ask them to repeat correctly in ${config.targetLanguage}.
    `;

    switch (config.mode) {
      case 'reconstruction':
        return `
          Role: Advanced Language Refiner.
          Task: 
          1. Listen to the user's sentence (which might be basic or incorrect).
          2. Do NOT just continue the conversation.
          3. Instead, say: "Here is a better way to say that:" and provide a corrected version.
             - If difficulty is Beginner/Intermediate: Provide a Correct and Standard version.
             - If difficulty is Advanced/Native: Provide a Sophisticated, Native-level version.
          4. Ask the user to repeat the improved version.
          5. Once they repeat, confirm if it was good, then ask the next question to keep the flow.
          ${commonRules}
        `;
      
      case 'critical_thinking':
        return `
          Role: Critical Thinking Debate Partner.
          Context/Words to use: "${config.topicOrWords || 'General Philosophy'}".
          Task:
          1. Start by creating a short, interesting, slightly controversial scenario or story using the Context/Words provided above.
             - Adjust the complexity of the story to the ${config.difficulty} level.
          2. Ask the user DEEP "Why", "How", or "What if" questions about it.
          3. Do NOT accept simple answers. Force the user to argue their point.
          4. If they give a short answer, ask: "Can you explain why you think that in more detail?"
          ${commonRules}
        `;

      case 'free_chat':
      default:
        return `
          Role: Strict Bilingual Tutor.
          Rules:
          1. Start and maintain conversation in ${config.targetLanguage}.
          2. Adhere strictly to the Speaking Pace and Vocabulary constraints defined in the Difficulty settings.
          3. Be very strict about pronunciation and grammar according to the Correction level defined.
          4. Explain mistakes in ${config.nativeLanguage} clearly.
          5. Make the user repeat correctly before moving on.
          ${commonRules}
        `;
    }
  };

  const updateMessages = (newText: string, role: 'user' | 'model', isFinal: boolean) => {
    setMessages(prev => {
      const newArr = [...prev];
      
      // DEDUPLICATION SAFEGUARD:
      // If we are trying to add a FINAL user message, check if the VERY LAST message
      // is already a final user message with the EXACT SAME text.
      // This prevents double rendering if the system echoes text or if state updates race.
      if (isFinal && role === 'user') {
          const lastMsg = newArr[newArr.length - 1];
          if (lastMsg && lastMsg.role === 'user' && lastMsg.text === newText && !lastMsg.isTentative) {
              return prev; // Ignore duplicate
          }
      }

      // SEARCH BACKWARDS: Find the last tentative message of THIS specific role.
      // This fixes the duplication bug where a Model message appearing before User finalization
      // would cause the User message to be duplicated instead of updated.
      let targetIndex = -1;
      for (let i = newArr.length - 1; i >= 0; i--) {
        if (newArr[i].role === role && newArr[i].isTentative) {
          targetIndex = i;
          break;
        }
      }

      // If we found a tentative message for this role, update it
      if (targetIndex !== -1) {
        if (isFinal) {
           newArr[targetIndex] = { 
             ...newArr[targetIndex], 
             text: newText || newArr[targetIndex].text, 
             isTentative: false 
           };
        } else {
           newArr[targetIndex] = { 
             ...newArr[targetIndex], 
             text: newText 
           };
        }
        return newArr;
      }

      // If no tentative message exists, create a new one
      if (newText) {
        return [
          ...prev,
          {
            id: Date.now().toString() + Math.random().toString().slice(2,5), // Unique ID to avoid collision
            role,
            text: newText,
            isTentative: !isFinal
          }
        ];
      }

      return prev;
    });
  };

  const sendText = useCallback(async (text: string) => {
    if (sessionPromiseRef.current) {
        // 1. Interrupt current audio playback immediately
        audioSourcesRef.current.forEach((source) => {
            try { source.stop(); } catch (e) {}
        });
        audioSourcesRef.current.clear();
        
        // Reset timestamp for next audio chunk
        if (outputAudioContextRef.current) {
            nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
        }

        try {
            const session = await sessionPromiseRef.current;
            
            // 2. Optimistically add the USER message as FINAL immediately
            // We use a unique ID. Logic in updateMessages will prevent duplication if echo occurs.
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                text: text,
                isTentative: false
            }]);

            const clientContent = { 
                turns: [{ 
                    role: 'user', 
                    parts: [{ text: text }] 
                }], 
                turnComplete: true 
            };

            // 3. Send text to Gemini Live
            // We check for method existence to avoid crashes on different SDK versions
            if (typeof session.send === 'function') {
                session.send({ clientContent });
            } else if (typeof (session as any).sendClientContent === 'function') {
                // Fallback for some SDK versions
                (session as any).sendClientContent(clientContent);
            } else {
                console.warn("Text messaging method not found on session object. This feature might not be supported in the current environment.");
                // We do not throw, to keep the session alive.
            }
        } catch (e) {
            console.error("Failed to send text:", e);
        }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!config) return;
    
    try {
      setStatus(SessionStatus.CONNECTING);
      setErrorMessage('');
      setMessages([]); // Reset messages on new connection

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
            // Handle Audio
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

            // Handle Transcriptions
            const outputTrans = message.serverContent?.outputTranscription;
            const inputTrans = message.serverContent?.inputTranscription;

            if (outputTrans?.text) {
                currentOutputTranscriptionRef.current += outputTrans.text;
                updateMessages(currentOutputTranscriptionRef.current, 'model', false);
            }

            if (inputTrans?.text) {
                currentInputTranscriptionRef.current += inputTrans.text;
                // Only update if we didn't just manually send this
                updateMessages(currentInputTranscriptionRef.current, 'user', false);
            }

            // Handle Turn Completion
            if (message.serverContent?.turnComplete) {
                // Finalize messages
                if (currentInputTranscriptionRef.current) {
                    updateMessages(currentInputTranscriptionRef.current, 'user', true);
                    currentInputTranscriptionRef.current = '';
                }
                if (currentOutputTranscriptionRef.current) {
                    updateMessages(currentOutputTranscriptionRef.current, 'model', true);
                    currentOutputTranscriptionRef.current = '';
                }
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted - clearing audio queue");
              audioSourcesRef.current.forEach((src) => {
                try { src.stop(); } catch(e) {}
              });
              audioSourcesRef.current.clear();
              if (outputAudioContextRef.current) {
                  nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
              }
              
              // Also finalize any pending model text as interrupted
              if (currentOutputTranscriptionRef.current) {
                   updateMessages(currentOutputTranscriptionRef.current + " ...", 'model', true);
                   currentOutputTranscriptionRef.current = '';
              }
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
          // Enable transcription
          inputAudioTranscription: {},
          outputAudioTranscription: {},
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
    sendText
  };
};