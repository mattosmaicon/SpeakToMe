import React, { useEffect, useRef, useState } from 'react';
import { LanguageConfig, SessionStatus, UILanguage } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, Brain, Languages, MessageSquare, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface ActiveSessionProps {
  config: LanguageConfig;
  onEndSession: () => void;
  uiLanguage: UILanguage;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ config, onEndSession, uiLanguage }) => {
  const { status, connect, disconnect, errorMessage, messages, currentVolume } = useGeminiLive(config);
  const t = TRANSLATIONS[uiLanguage].active;
  const tLabels = TRANSLATIONS[uiLanguage].modeLabels;
  
  // Default to showing transcript if in Interview or Reconstruction mode
  const [showTranscript, setShowTranscript] = useState(config.mode === 'interview' || config.mode === 'reconstruction');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, showTranscript]);

  const isConnected = status === SessionStatus.CONNECTED;

  const getModeIcon = () => {
    switch (config.mode) {
      case 'reconstruction': return <Sparkles className="w-5 h-5 text-amber-400" />;
      case 'critical_thinking': return <Brain className="w-5 h-5 text-pink-400" />;
      case 'translator': return <Languages className="w-5 h-5 text-cyan-400" />;
      case 'interview': return <Briefcase className="w-5 h-5 text-emerald-400" />;
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
    <div className="relative flex flex-col items-center justify-between h-full w-full py-6 px-4 overflow-hidden">
      
      {/* Header */}
      <div className="w-full flex justify-between items-center max-w-md z-10 shrink-0 mb-4">
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

      {/* Main Content Area - Flexible Space */}
      <div className="flex-1 w-full max-w-md relative flex flex-col items-center justify-center min-h-0">
        
        {/* TOPIC INDICATOR (If applicable) */}
        {(config.mode === 'critical_thinking' || config.mode === 'interview') && config.topicOrWords && !showTranscript && (
          <div className="absolute top-0 w-full bg-slate-800/60 border border-slate-700 p-3 rounded-xl backdrop-blur-sm z-10 mb-4 animate-in fade-in slide-in-from-top-2">
            <h4 className="text-xs text-indigo-400 font-bold uppercase mb-1">{t.currentFocus}</h4>
            <p className="text-slate-200 text-sm font-medium leading-relaxed line-clamp-2">
              "{config.topicOrWords}"
            </p>
          </div>
        )}

        {/* TRANSCRIPT VIEW (Chat Mode) */}
        {showTranscript ? (
          <div className="w-full h-full bg-slate-900/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none" />
            
            <div 
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth pb-20"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 opacity-60">
                  <MessageSquare className="w-8 h-8" />
                  <p className="text-sm">Start speaking to see transcript...</p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                  } ${!msg.isFinal ? 'opacity-70 animate-pulse' : ''}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent z-10 pointer-events-none" />
          </div>
        ) : (
          /* ORB VISUALIZER MODE */
          <div className="flex flex-col items-center justify-center w-full h-full">
            {status === SessionStatus.CONNECTING && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                <p className="text-indigo-300 animate-pulse">{t.connecting}</p>
              </div>
            )}

            {isConnected && (
              <div className="relative group cursor-pointer" onClick={() => setShowTranscript(true)}>
                {/* Audio Reactive Pulse */}
                <div 
                  className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl transition-all duration-100 ease-out opacity-40"
                  style={{ transform: `scale(${1 + (currentVolume / 255) * 1.5})` }}
                ></div>
                
                <div className="relative w-40 h-40 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-500/30 transition-transform duration-100 ease-out"
                     style={{ transform: `scale(${1 + (currentVolume / 255) * 0.2})` }}>
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
        )}

      </div>

      {/* Footer Controls */}
      <div className="w-full max-w-md flex flex-col gap-3 shrink-0 mt-4 z-20">
        
        {isConnected && (
           <button
             onClick={() => setShowTranscript(!showTranscript)}
             className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400 hover:text-white py-2 transition-colors"
           >
             {showTranscript ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
             {showTranscript ? t.hideTranscript : t.showTranscript}
           </button>
        )}
        
        <button
          onClick={isConnected ? disconnect : connect}
          className={`w-full py-4 rounded-xl font-semibold transition-all shadow-lg ${
            isConnected 
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' 
              : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-500/20'
          }`}
        >
          {isConnected ? t.end : t.reconnect}
        </button>
      </div>
    </div>
  );
};

export default ActiveSession;