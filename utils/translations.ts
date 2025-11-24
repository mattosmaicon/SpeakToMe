import { UILanguage } from '../types';

export const TRANSLATIONS = {
  en: {
    setup: {
      step1Title: "Choose your languages",
      step2Title: "What is your fluency level?",
      step3Title: "Choose your training mode",
      iSpeak: "I speak...",
      wantToLearn: "I want to learn...",
      next: "Next Step",
      start: "Start Session",
      topicLabel: "Topic or Words to use:",
      topicPlaceholder: "e.g. Technology, Global Warming, or specific words...",
      back: "Back",
      requiresAdvanced: "Requires Advanced or Native level",
      difficulty: {
        beginner: {
          title: "Beginner (A1-A2)",
          desc: "Speak slowly, simple words, be patient."
        },
        intermediate: {
          title: "Intermediate (B1-B2)",
          desc: "Normal speed, standard vocabulary, correct major errors."
        },
        advanced: {
          title: "Advanced (C1)",
          desc: "Natural speed, complex topics, strict correction."
        },
        native: {
          title: "Native Like (C2)",
          desc: "Fast pace, idioms, slang, deep nuance."
        }
      },
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
          desc: "Instant bidirectional translation between selected languages."
        }
      },
      settings: "Settings",
      uiLanguage: "Interface Language",
      installApp: "Install App",
      close: "Close"
    },
    active: {
      end: "End Conversation",
      reconnect: "Reconnect",
      listening: "Listening... Speak naturally.",
      translateHint: (lang: string) => `Translating between selected languages...`,
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
      step2Title: "Qual seu nível de fluência?",
      step3Title: "Escolha seu modo de treino",
      iSpeak: "Eu falo...",
      wantToLearn: "Eu quero aprender...",
      next: "Próximo Passo",
      start: "Iniciar Sessão",
      topicLabel: "Tópico ou Palavras para usar:",
      topicPlaceholder: "ex: Tecnologia, Aquecimento Global, ou palavras específicas...",
      back: "Voltar",
      requiresAdvanced: "Requer nível Avançado ou Nativo",
      difficulty: {
        beginner: {
          title: "Iniciante (A1-A2)",
          desc: "Fale devagar, palavras simples, seja paciente."
        },
        intermediate: {
          title: "Intermediário (B1-B2)",
          desc: "Velocidade normal, vocabulário padrão, corrija erros maiores."
        },
        advanced: {
          title: "Avançado (C1)",
          desc: "Velocidade natural, tópicos complexos, correção rigorosa."
        },
        native: {
          title: "Nativo (C2)",
          desc: "Ritmo rápido, gírias, expressões, nuances profundas."
        }
      },
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
          desc: "Tradução bidirecional instantânea entre os idiomas."
        }
      },
      settings: "Configurações",
      uiLanguage: "Idioma da Interface",
      installApp: "Instalar App",
      close: "Fechar"
    },
    active: {
      end: "Encerrar Conversa",
      reconnect: "Reconectar",
      listening: "Ouvindo... Fale naturalmente.",
      translateHint: (lang: string) => `Traduzindo entre os idiomas selecionados...`,
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