import React, { useState } from 'react';
import SetupScreen from './components/SetupScreen';
import ActiveSession from './components/ActiveSession';
import { LanguageConfig } from './types';

const App: React.FC = () => {
  const [config, setConfig] = useState<LanguageConfig | null>(null);

  const handleStart = (newConfig: LanguageConfig) => {
    setConfig(newConfig);
  };

  const handleEndSession = () => {
    setConfig(null);
  };

  return (
    <div className="h-full w-full bg-slate-900 overflow-hidden">
      {!config ? (
        <SetupScreen onStart={handleStart} />
      ) : (
        <ActiveSession config={config} onEndSession={handleEndSession} />
      )}
    </div>
  );
};

export default App;
