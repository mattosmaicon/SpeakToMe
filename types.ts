export interface LanguageConfig {
  nativeLanguage: string;
  targetLanguage: string;
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
