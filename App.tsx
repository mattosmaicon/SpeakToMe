import React, { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import ActiveSession from './components/ActiveSession';
import { LanguageConfig, UILanguage } from './types';

const App: React.FC = () => {
  const [config, setConfig] = useState<LanguageConfig | null>(null);
  const [uiLanguage, setUiLanguage] = useState<UILanguage>('en');

  const handleStart = (newConfig: LanguageConfig) => {
    setConfig(newConfig);
  };

  const handleEndSession = () => {
    setConfig(null);
  };

  return (
    <div className="h-full w-full bg-slate-900 overflow-hidden">
      {!config ? (
        <SetupScreen 
          onStart={handleStart} 
          uiLanguage={uiLanguage}
          setUiLanguage={setUiLanguage}
        />
      ) : (
        <ActiveSession 
          config={config} 
          onEndSession={handleEndSession} 
          uiLanguage={uiLanguage}
        />
      )}
    </div>
  );
};

export default App;