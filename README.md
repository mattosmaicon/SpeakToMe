# SpeakToMe 🎙️

> **Aplicativo criado por mim utilizando o Google AI Studio.**

O **SpeakToMe** é um tutor de idiomas inteligente e em tempo real. Ele utiliza a mais recente tecnologia **Gemini Live API** do Google para simular uma conversa humana natural, adaptando-se ao seu nível de fluência, idioma nativo e objetivos de aprendizado.

Este projeto demonstra o poder da IA multimodal, permitindo conversação fluida com latência ultrabaixa, correções gramaticais instantâneas e modos de treino específicos.

---

## ✨ Funcionalidades

O aplicativo possui 4 modos de operação distintos, configuráveis para diferentes níveis de proficiência (do Iniciante A1 ao Nativo C2):

1.  **Conversação Livre:** Bate-papo natural onde a IA age como um tutor paciente ou rigoroso, dependendo do nível escolhido.
2.  **Upgrade de Frase (Reconstrução):** Você fala uma frase simples (ou "quebrada") e a IA a repete utilizando gramática perfeita e vocabulário nativo. Ideal para refinar a dicção.
3.  **Pensamento Crítico:** A IA assume o papel de "Advogado do Diabo", desafiando seus argumentos sobre um tópico específico para forçar o uso de vocabulário complexo sob pressão.
4.  **Tradutor Ao Vivo:** Tradução simultânea bidirecional entre dois idiomas selecionados.

### Diferenciais Técnicos
*   **Voz Natural:** Utiliza os novos modelos de voz do Gemini para entonação humana.
*   **Baixa Latência:** Conexão via WebSocket direto com a API Gemini Live.
*   **PWA (Progressive Web App):** Pode ser instalado no celular ou desktop como um aplicativo nativo.
*   **Multilíngue:** Interface totalmente traduzida para Inglês e Português.

---

## 🛠️ Tecnologias Utilizadas

*   **Google AI Studio & Gemini Live API:** O cérebro por trás da conversação (`gemini-2.5-flash-native-audio-preview`).
*   **React 19:** Biblioteca frontend moderna.
*   **Vite:** Build tool ultrarrápida.
*   **TypeScript:** Para segurança e robustez do código.
*   **TailwindCSS:** Para estilização responsiva e moderna.
*   **Web Audio API:** Para processamento e streaming de áudio em tempo real (PCM 16kHz).

---

## 🚀 Como Instalar e Rodar

Siga este passo a passo para rodar o projeto em sua máquina.

### Pré-requisitos
*   **Node.js** (versão 18 ou superior).
*   Uma **Google Gemini API Key** (Siga o passo 1 abaixo).

### Passo 1: Obter a API Key
1.  Acesse o [Google AI Studio](https://aistudio.google.com/).
2.  Faça login com sua conta Google.
3.  Clique em **"Get API key"**.
4.  Crie uma chave em um projeto novo ou existente (Lembre-se: Para usar o modelo Live, é necessário um projeto com faturamento ativado no Google Cloud, embora haja tier gratuito para testes dependendo da região).

### Passo 2: Instalação
1.  Clone este repositório ou baixe os arquivos.
2.  Abra o terminal na pasta do projeto.
3.  Instale as dependências:
    ```bash
    npm install
    ```

### Passo 3: Configuração da Chave
Para segurança, a chave não fica no código. Você deve configurar uma variável de ambiente.

1.  Na raiz do projeto, crie um arquivo chamado `.env`.
2.  Adicione a seguinte linha dentro dele (substitua pela sua chave):
    ```env
    API_KEY=sua_chave_comecando_com_AIzaSy_aqui
    ```

### Passo 4: Rodar
No terminal, execute:
```bash
npm run dev
```
O aplicativo estará disponível em `http://localhost:3000`.

---

## 📱 Utilizando como App Mobile (PWA)

Este aplicativo é um PWA. Isso significa que você pode instalá-lo no seu celular Android ou iOS sem precisar da loja de aplicativos.

1.  Acesse o endereço do app pelo navegador do celular (se estiver rodando localmente, você precisará acessar via IP da sua máquina na rede, ex: `192.168.1.5:3000`, e o navegador pode pedir permissão de microfone insegura. Para produção, recomenda-se hospedar em HTTPS, como Vercel ou Netlify).
2.  **No Android (Chrome):** Toque nos três pontinhos e selecione "Instalar aplicativo" ou "Adicionar à tela inicial".
3.  **No iOS (Safari):** Toque no botão de compartilhar e selecione "Adicionar à Tela de Início".

---

## 👤 Autor

Criado por mim, com auxílio das ferramentas de ponta do **Google AI Studio**.

---
*Nota: Este aplicativo requer permissão de uso do microfone para funcionar.*
