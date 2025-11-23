import React, { useState } from 'react';
import { LanguageConfig, SessionMode, UILanguage } from '../types';
import { Mic, Globe, ArrowRight, Sparkles, Brain, Languages, MessageSquare, ChevronLeft, Settings, X } from 'lucide-react';
import { TRANSLATIONS, DISPLAY_LANGUAGES } from '../utils/translations';

interface SetupScreenProps {
  onStart: (config: LanguageConfig) => void;
  uiLanguage: UILanguage;
  setUiLanguage: (lang: UILanguage) => void;
}

const MODES_ICONS = {
  free_chat: MessageSquare,
  reconstruction: Sparkles,
  critical_thinking: Brain,
  translator: Languages,
};

const SetupScreen: React.FC<SetupScreenProps> = ({ onStart, uiLanguage, setUiLanguage }) => {
  const [step, setStep] = useState(1);
  const [native, setNative] = useState(DISPLAY_LANGUAGES[uiLanguage][0]);
  const [target, setTarget] = useState(DISPLAY_LANGUAGES[uiLanguage][1]);
  const [selectedMode, setSelectedMode] = useState<SessionMode>('free_chat');
  const [topic, setTopic] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const t = TRANSLATIONS[uiLanguage].setup;
  const currentLangList = DISPLAY_LANGUAGES[uiLanguage];

  const handleStart = () => {
    onStart({ 
      nativeLanguage: native, 
      targetLanguage: target,
      mode: selectedMode,
      topicOrWords: topic 
    });
  };

  const getModeInfo = (modeKey: SessionMode) => {
    return t.modes[modeKey];
  };

  const ModeIcon = MODES_ICONS[selectedMode] || MessageSquare;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 max-w-md mx-auto w-full transition-all relative">
      
      {/* Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{t.settings}</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <label className="text-sm font-medium text-slate-300 block">
                {t.uiLanguage}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setUiLanguage('en')}
                  className={`py-3 rounded-xl border font-medium transition-all ${
                    uiLanguage === 'en'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setUiLanguage('pt')}
                  className={`py-3 rounded-xl border font-medium transition-all ${
                    uiLanguage === 'pt'
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  Português
                </button>
              </div>
            </div>

            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-all"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-600 mb-4 shadow-lg shadow-indigo-500/20">
          <Mic className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
          SpeakToMe
        </h1>
        <p className="text-slate-400 mt-2">
          {step === 1 ? t.step1Title : t.step2Title}
        </p>
      </div>

      <div className="w-full bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm transition-all duration-300">
        
        {step === 1 ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Globe className="w-4 h-4" /> {t.iSpeak}
              </label>
              <select 
                value={native}
                onChange={(e) => setNative(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {currentLangList.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                 <Globe className="w-4 h-4 text-indigo-400" /> {t.wantToLearn}
              </label>
              <select 
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              >
                {currentLangList.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 mt-4"
            >
              {t.next}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(t.modes) as SessionMode[]).map((modeKey) => {
                const info = getModeInfo(modeKey);
                const Icon = MODES_ICONS[modeKey];
                return (
                  <button
                    key={modeKey}
                    onClick={() => setSelectedMode(modeKey)}
                    className={`relative p-4 rounded-xl text-left border transition-all ${
                      selectedMode === modeKey 
                        ? 'bg-indigo-600/20 border-indigo-500' 
                        : 'bg-slate-900/50 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${selectedMode === modeKey ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${selectedMode === modeKey ? 'text-white' : 'text-slate-200'}`}>
                          {info.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          {info.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedMode === 'critical_thinking' && (
               <div className="space-y-2 pt-2 animate-in fade-in zoom-in-95">
               <label className="text-sm font-medium text-indigo-300 flex items-center gap-2">
                  {t.topicLabel}
               </label>
               <input
                 type="text"
                 value={topic}
                 onChange={(e) => setTopic(e.target.value)}
                 placeholder={t.topicPlaceholder}
                 className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
               />
             </div>
            )}

            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setStep(1)}
                className="px-4 py-4 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={handleStart}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
              >
                {t.start}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SetupScreen;