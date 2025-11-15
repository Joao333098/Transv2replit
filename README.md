
# Editor Inteligente com IA

Aplicação web completa com três funcionalidades principais integradas com a API Gemini.

## 🚀 Funcionalidades

### 1. Editor de Documentos (Tema iOS Branco)
- ✍️ Editor minimalista com auto-save
- 🤖 Organização automática com IA
- 📝 Correção ortográfica e gramatical
- 💬 Chat assistente multimodal
- 📊 Resumos inteligentes
- 💾 Salvamento offline com IndexedDB

### 2. Gerenciador de Arquivos (Tema Neon Dark)
- 📁 Upload e armazenamento de arquivos
- 🎨 Interface neon cyberpunk
- 🔍 Busca e filtros inteligentes
- 📤 Drag & drop support
- 🏷️ Sistema de tags automático

### 3. Transcrição com IA
- 🎤 Gravação em tempo real
- 🌍 Suporte para PT, EN, ES
- 🤖 50+ funcionalidades de IA:
  - Resumo automático
  - Palavras-chave
  - Geração de perguntas
  - Tradução
  - Q&A sobre o conteúdo
- 📝 Edição de transcrições
- 💾 Exportação em múltiplos formatos

## ⚙️ Configuração

1. **Obtenha suas chaves da API Gemini:**
   - Acesse: https://aistudio.google.com/apikey
   - Gere 4 chaves separadas (ou use a mesma para todas)

2. **Configure o arquivo `config.json`:**
```json
{
  "gemini": {
    "editor": "SUA_CHAVE_AQUI",
    "chat": "SUA_CHAVE_AQUI",
    "transcription": "SUA_CHAVE_AQUI",
    "fileAnalysis": "SUA_CHAVE_AQUI"
  }
}
```

3. **Execute a aplicação:**
   - Clique no botão **Run** no Replit
   - Acesse em: http://localhost:5000

## 📱 Navegação

Use as 3 barras no topo para alternar entre:
- **Editor** - Escrever e editar documentos
- **Arquivos** - Gerenciar uploads
- **Transcrição** - Gravar e transcrever áudio

## 🎨 Design

- **Editor:** Design inspirado no iOS 16+ (branco, limpo, minimalista)
- **Arquivos:** Tema neon dark (preto + ciano/magenta)
- **Transcrição:** Tema híbrido com painéis organizados

## 💾 Armazenamento

Tudo é salvo localmente usando **IndexedDB**:
- Documentos são salvos automaticamente a cada 3 segundos
- Arquivos são armazenados em Base64
- Transcrições são preservadas

## 🔐 Segurança

- Nunca commite o arquivo `config.json` com suas chaves
- As chaves são usadas apenas no lado do cliente
- Dados armazenados localmente no navegador

## 🌟 Recursos Avançados

### Chat IA
- Pergunte sobre o documento
- Anexe PDFs e imagens
- Contexto automático

### Organização Automática
- Correção gramatical
- Estruturação de parágrafos
- Geração de títulos

### Transcrição IA
- Reconhecimento de voz em tempo real
- 20 recursos de IA
- 30 recursos de usabilidade

## 🛠️ Tecnologias

- Vanilla JavaScript (ES6+)
- IndexedDB para storage
- Web Speech API
- Gemini API
- Express.js
- CSS Grid & Flexbox

## 📝 Licença

MIT License - Livre para usar e modificar!
