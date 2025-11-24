import React, { useEffect, useRef, useState } from 'react';
import { LanguageConfig, SessionStatus, UILanguage } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, Brain, Languages, MessageSquare, Send } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface ActiveSessionProps {
  config: LanguageConfig;
  onEndSession: () => void;
  uiLanguage: UILanguage;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ config, onEndSession, uiLanguage }) => {
  const { status, connect, disconnect, errorMessage, messages, sendText } = useGeminiLive(config);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const t = TRANSLATIONS[uiLanguage].active;
  const tLabels = TRANSLATIONS[uiLanguage].modeLabels;

  // Auto-connect on mount
  useEffect(() => {
    connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendText(inputText);
    setInputText('');
  };

  const isConnected = status === SessionStatus.CONNECTED;

  const getModeIcon = () => {
    switch (config.mode) {
      case 'reconstruction': return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'critical_thinking': return <Brain className="w-4 h-4 text-pink-400" />;
      case 'translator': return <Languages className="w-4 h-4 text-cyan-400" />;
      default: return <MessageSquare className="w-4 h-4 text-indigo-400" />;
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
    <div className="relative flex flex-col h-full w-full bg-slate-900">
      
      {/* Top Header Section (Fixed) */}
      <div className="flex-none p-4 bg-slate-900/95 backdrop-blur z-10 border-b border-slate-800">
        <div className="flex justify-between items-start max-w-2xl mx-auto w-full">
            <div className="flex items-center gap-3">
                {/* Mini Visualizer */}
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-indigo-600 shadow-lg shadow-indigo-500/30' : 'bg-slate-800'}`}>
                    {isConnected ? (
                        <>
                            <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-soft-pulse"></div>
                            <Mic className="w-6 h-6 text-white relative z-10" />
                        </>
                    ) : (
                        status === SessionStatus.CONNECTING ? <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /> : <MicOff className="w-5 h-5 text-slate-500" />
                    )}
                </div>
                
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {getModeIcon()}
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{getModeLabel()}</span>
                    </div>
                    <span className="text-base font-bold text-slate-200">{config.targetLanguage}</span>
                </div>
            </div>

            <button 
                onClick={onEndSession}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
        
        {/* Connection Status Text */}
        <div className="max-w-2xl mx-auto w-full mt-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <p className="text-xs text-slate-500">
                {status === SessionStatus.CONNECTING ? t.connecting : 
                 isConnected ? t.listening : "Disconnected"}
            </p>
        </div>
      </div>

      {/* Middle Chat Section (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        <div className="max-w-2xl mx-auto w-full space-y-4 pb-4">
            {messages.length === 0 && isConnected && (
                <div className="flex flex-col items-center justify-center h-48 text-center opacity-50">
                    <MessageSquare className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-slate-500 text-sm">{t.listening}</p>
                </div>
            )}
            
            {messages.map((msg, index) => (
                <div 
                    key={msg.id + index} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div 
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            msg.role === 'user' 
                                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'
                        } ${msg.isTentative ? 'opacity-70' : ''}`}
                    >
                        {msg.text}
                        {msg.isTentative && (
                             <span className="inline-block w-1.5 h-1.5 bg-current rounded-full ml-1 animate-pulse"/>
                        )}
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Bottom Controls (Fixed) */}
      <div className="flex-none p-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-2xl mx-auto w-full flex flex-col gap-3">
             {/* Text Input */}
            <form onSubmit={handleSendText} className="relative flex items-center gap-2">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.typeMessage}
                    disabled={!isConnected}
                    autoComplete="off"
                    className="flex-1 bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!isConnected || !inputText.trim()}
                    className="absolute right-2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white rounded-lg transition-colors"
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>

            <button
                onClick={isConnected ? disconnect : connect}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isConnected 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
            >
                {isConnected ? t.end : t.reconnect}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveSession;