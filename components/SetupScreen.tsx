import React, { useState } from 'react';
import { LanguageConfig } from '../types';
import { Mic, Globe, ArrowRight } from 'lucide-react';

interface SetupScreenProps {
  onStart: (config: LanguageConfig) => void;
}

const LANGUAGES = [
  "Portuguese", "English", "Spanish", "French", "German", 
  "Italian", "Japanese", "Chinese", "Russian", "Korean"
];

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart }) => {
  const [native, setNative] = useState('Portuguese');
  const [target, setTarget] = useState('English');

  const handleStart = () => {
    onStart({ nativeLanguage: native, targetLanguage: target });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 max-w-md mx-auto w-full">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 mb-4 shadow-lg shadow-indigo-500/20">
          <Mic className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          SpeakToMe
        </h1>
        <p className="text-slate-400 mt-2">
          Your AI conversation partner. No setup, just talk.
        </p>
      </div>

      <div className="w-full space-y-6 bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4" /> I speak...
          </label>
          <select 
            value={native}
            onChange={(e) => setNative(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
             <Globe className="w-4 h-4 text-indigo-400" /> I want to learn...
          </label>
          <select 
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <button 
          onClick={handleStart}
          className="w-full group bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
        >
          Start Conversation
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      <p className="text-xs text-slate-500 mt-6 text-center max-w-xs">
        Ensure you are in a quiet environment and have microphone permissions enabled.
      </p>
    </div>
  );
};

export default SetupScreen;
