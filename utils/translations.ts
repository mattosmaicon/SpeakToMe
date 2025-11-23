import { UILanguage } from '../types';

export const TRANSLATIONS = {
  en: {
    setup: {
      step1Title: "Choose your languages",
      step2Title: "Choose your training mode",
      iSpeak: "I speak...",
      wantToLearn: "I want to learn...",
      next: "Next Step",
      start: "Start Session",
      topicLabel: "Topic or Words to use:",
      topicPlaceholder: "e.g. Technology, Global Warming, or specific words...",
      back: "Back",
      modes: {
        free_chat: {
          title: "Free Conversation",
          desc: "Natural practice with a strict tutor."
        },
        reconstruction: {
          title: "Upgrade My Sentence",
          desc: "You speak simply, AI rewrites it to Native Level (C1/C2)."
        },
        critical_thinking: {
          title: "Critical Thinking",
          desc: "Debate and argue using specific words or topics."
        },
        translator: {
          title: "Live Translator",
          desc: "Speak in your language, AI translates to target."
        }
      },
      settings: "Settings",
      uiLanguage: "Interface Language",
      close: "Close"
    },
    active: {
      end: "End Conversation",
      reconnect: "Reconnect",
      listening: "Listening... Speak naturally.",
      translateHint: (lang: string) => `Speak ${lang}, I'll translate.`,
      interruptHint: "AI will interrupt to correct pronunciation & grammar.",
      connectionIssue: "Connection Issue",
      goBack: "Go Back",
      liveSession: "Live Session",
      currentFocus: "Current Focus",
      connecting: "Connecting to AI..."
    },
    modeLabels: {
      free_chat: "Free Conversation",
      reconstruction: "Message Upgrade",
      critical_thinking: "Critical Thinking",
      translator: "Translator Mode"
    }
  },
  pt: {
    setup: {
      step1Title: "Escolha seus idiomas",
      step2Title: "Escolha seu modo de treino",
      iSpeak: "Eu falo...",
      wantToLearn: "Eu quero aprender...",
      next: "Próximo Passo",
      start: "Iniciar Sessão",
      topicLabel: "Tópico ou Palavras para usar:",
      topicPlaceholder: "ex: Tecnologia, Aquecimento Global, ou palavras específicas...",
      back: "Voltar",
      modes: {
        free_chat: {
          title: "Conversação Livre",
          desc: "Prática natural com um tutor rigoroso."
        },
        reconstruction: {
          title: "Reconstrução de Frases",
          desc: "Fale simples, a IA reescreve em nível nativo (C1/C2)."
        },
        critical_thinking: {
          title: "Pensamento Crítico",
          desc: "Debata e argumente usando palavras ou tópicos específicos."
        },
        translator: {
          title: "Tradutor Ao Vivo",
          desc: "Fale no seu idioma, a IA traduz para o alvo."
        }
      },
      settings: "Configurações",
      uiLanguage: "Idioma da Interface",
      close: "Fechar"
    },
    active: {
      end: "Encerrar Conversa",
      reconnect: "Reconectar",
      listening: "Ouvindo... Fale naturalmente.",
      translateHint: (lang: string) => `Fale ${lang}, eu traduzirei.`,
      interruptHint: "A IA irá interromper para corrigir pronúncia e gramática.",
      connectionIssue: "Problema de Conexão",
      goBack: "Voltar",
      liveSession: "Sessão Ao Vivo",
      currentFocus: "Foco Atual",
      connecting: "Conectando à IA..."
    },
    modeLabels: {
      free_chat: "Conversação Livre",
      reconstruction: "Reconstrução",
      critical_thinking: "Pensamento Crítico",
      translator: "Modo Tradutor"
    }
  }
};

export const DISPLAY_LANGUAGES = {
  en: [
    "Portuguese", "English", "Spanish", "French", "German", 
    "Italian", "Japanese", "Chinese", "Russian", "Korean"
  ],
  pt: [
    "Português", "Inglês", "Espanhol", "Francês", "Alemão", 
    "Italiano", "Japonês", "Chinês", "Russo", "Coreano"
  ]
};
