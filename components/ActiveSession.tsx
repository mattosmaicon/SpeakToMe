import React, { useEffect, useState, useRef } from 'react';
import { LanguageConfig, SessionStatus, UILanguage } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { Mic, MicOff, X, Activity, Loader2, Sparkles, Brain, Languages, MessageSquare, Send, ArrowUp } from 'lucide-react';
import { TRANSLATIONS } from '../utils/translations';

interface ActiveSessionProps {
  config: LanguageConfig;
  onEndSession: () => void;
  uiLanguage: UILanguage;
}

const ActiveSession: React.FC<ActiveSessionProps> = ({ config, onEndSession, uiLanguage }) => {
  const { status, connect, disconnect, errorMessage, messages, sendTextMessage } = useGeminiLive(config);
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (inputText.trim()) {
      sendTextMessage(inputText);
      setInputText('');
    }
  };

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
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-900">
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
    <div className="flex flex-col h-full w-full bg-slate-900 overflow-hidden">
      
      {/* Header */}
      <div className="flex-none w-full bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 z-10 p-4">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
             {/* Small Visualizer Status */}
             <div className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${isConnected ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                {status === SessionStatus.CONNECTING ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : isConnected ? (
                  <>
                    <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20"></div>
                    <Mic className="w-5 h-5 text-white" />
                  </>
                ) : (
                  <MicOff className="w-5 h-5 text-slate-400" />
                )}
             </div>
             <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {getModeIcon()}
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{getModeLabel()}</span>
                </div>
                <span className="text-sm font-bold text-indigo-100">{config.targetLanguage}</span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button
              onClick={isConnected ? disconnect : connect}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isConnected 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
              }`}
            >
              {isConnected ? t.end : t.reconnect}
            </button>
            <button 
              onClick={onEndSession}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
        <div className="max-w-2xl mx-auto space-y-4 min-h-full flex flex-col justify-end pb-4">
          {/* Empty State / Welcome */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 text-center opacity-60 py-10">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-600/20 to-blue-600/20 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-slate-400 text-sm">{t.listening}</p>
              {config.mode === 'critical_thinking' && config.topicOrWords && (
                <p className="text-pink-400 text-xs font-bold mt-2 bg-pink-500/10 px-3 py-1 rounded-full">
                  Topic: {config.topicOrWords}
                </p>
              )}
            </div>
          )}

          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id || index} 
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    isUser 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none'
                  } ${!msg.isFinal && 'opacity-70'}`}
                >
                  {msg.text}
                  {!msg.isFinal && <span className="animate-pulse">...</span>}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none bg-slate-900 p-4 border-t border-slate-800">
         <div className="max-w-2xl mx-auto relative">
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
               <div className="relative flex-1">
                 <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t.typeMessage}
                    disabled={!isConnected}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-full pl-5 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 placeholder:text-slate-500"
                 />
                 <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <button 
                      type="submit"
                      disabled={!inputText.trim() || !isConnected}
                      className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 transition-all"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>
                 </div>
               </div>
            </form>
            
            <div className="text-center mt-2">
               <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3" />
                  {isConnected ? t.liveSession : t.connectionIssue}
               </p>
            </div>
         </div>
      </div>

    </div>
  );
};

export default ActiveSession;
