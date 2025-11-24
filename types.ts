export type SessionMode = 'free_chat' | 'reconstruction' | 'critical_thinking' | 'translator';
export type UILanguage = 'en' | 'pt';
export type FluencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'native';

export interface LanguageConfig {
  nativeLanguage: string;
  targetLanguage: string;
  mode: SessionMode;
  difficulty: FluencyLevel;
  topicOrWords?: string; // Used for critical_thinking mode
}

export enum SessionStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface AudioContextState {
  inputAudioContext: AudioContext | null;
  outputAudioContext: AudioContext | null;
}