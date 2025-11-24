import React, { useEffect } from 'react';
import { LanguageConfig, SessionStatus, UILanguage } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, Brain, Languages, MessageSquare } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface ActiveSessionProps {
  config: LanguageConfig;
  onEndSession: () => void;
  uiLanguage: UILanguage;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ config, onEndSession, uiLanguage }) => {
  const { status, connect, disconnect, errorMessage } = useGeminiLive(config);
  const t = TRANSLATIONS[uiLanguage].active;
  const tLabels = TRANSLATIONS[uiLanguage].modeLabels;

  // Auto-connect on mount
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const isConnected = status === SessionStatus.CONNECTED;

  const getModeIcon = () => {
    switch (config.mode) {
      case 'reconstruction': return <Sparkles className="w-5 h-5 text-amber-400" />;
      case 'critical_thinking': return <Brain className="w-5 h-5 text-pink-400" />;
      case 'translator': return <Languages className="w-5 h-5 text-cyan-400" />;
      default: return <MessageSquare className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getModeLabel = () => {
    return tLabels[config.mode];
  };

  if (errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <MicOff className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{t.connectionIssue}</h3>
        <p className="text-slate-400 mb-6">{errorMessage}</p>
        <button 
          onClick={onEndSession}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          {t.goBack}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-between h-full w-full py-12 px-6">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center max-w-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            {getModeIcon()}
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{getModeLabel()}</span>
          </div>
          <span className="text-lg font-bold text-indigo-300">{config.targetLanguage}</span>
        </div>
        <button 
          onClick={onEndSession}
          className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Visualizer / Center Status */}
      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md">
        
        {config.mode === 'critical_thinking' && config.topicOrWords && (
          <div className="mb-8 w-full bg-slate-800/60 border border-slate-700 p-4 rounded-xl backdrop-blur-sm">
            <h4 className="text-xs text-pink-400 font-bold uppercase mb-1">{t.currentFocus}</h4>
            <p className="text-slate-200 text-sm font-medium leading-relaxed">
              "{config.topicOrWords}"
            </p>
          </div>
        )}

        {status === SessionStatus.CONNECTING && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <p className="text-indigo-300 animate-pulse">{t.connecting}</p>
          </div>
        )}

        {isConnected && (
          <div className="relative">
            {/* Pulsing Effect */}
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-soft-pulse blur-xl"></div>
            
            <div className="relative w-40 h-40 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30">
              <Mic className="w-16 h-16 text-white" />
            </div>

            <div className="mt-12 text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400 font-medium bg-emerald-400/10 px-4 py-1 rounded-full w-fit mx-auto">
                <Activity className="w-4 h-4" />
                <span>{t.liveSession}</span>
              </div>
              <p className="text-slate-400 text-sm max-w-[200px]">
                {config.mode === 'translator' 
                  ? t.translateHint(config.nativeLanguage)
                  : t.listening}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-md flex flex-col gap-4">
        {isConnected && (
            <div className="text-center text-xs text-slate-600">
               {t.interruptHint}
            </div>
        )}
        
        <button
          onClick={isConnected ? disconnect : connect}
          className={`w-full py-4 rounded-xl font-semibold transition-all ${
            isConnected 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500'
          }`}
        >
          {isConnected ? t.end : t.reconnect}
        </button>
      </div>
    </div>
  );
};

export default ActiveSession;