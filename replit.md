# Writebox - Editor Inteligente com IA

## Overview

Writebox é um editor de documentos minimalista e inteligente inspirado no write-box.appspot.com, completamente redesenhado com navegação moderna e funcionalidades de IA. A aplicação possui cinco áreas funcionais distintas:

1. **Editor** - Design minimalista branco sem distrações, com organização automática, correção de texto e geração de títulos por IA
2. **Documentos** - Lista organizada de todos os documentos salvos com busca e preview
3. **Chat IA** - Página dedicada para conversar com IA, com suporte para envio de mensagens, PDFs e fotos
4. **Arquivos** - Interface neon dark cyberpunk para upload e gerenciamento de arquivos
5. **Transcrição** - Transcrição de áudio em tempo real com 13+ ferramentas de IA (resumir, traduzir, palavras-chave, etc.)

A aplicação utiliza armazenamento offline com IndexedDB, salvamento automático e integração segura com a API Gemini via servidor proxy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Single-Page Application (SPA) Structure**
- Pure vanilla JavaScript (ES6+) implementation without frameworks
- Component-based architecture with classes: NavigationManager, EditorManager, DocumentsManager, ChatManager, FilesManager, TranscriptionManager, StorageManager
- Mobile-first responsive design with animated hamburger menu navigation (3 bars)
- Page-based routing system using data attributes and classList manipulation
- Sidebar navigation with smooth transitions and overlay backdrop

**Theme System**
- Dual theme architecture: iOS-inspired minimal white theme for editor/documents, neon dark cyberpunk theme for file manager
- CSS custom properties (variables) for centralized theme management
- Separate visual identities for different functional areas to provide context-appropriate UX

**Offline-First Data Strategy**
- IndexedDB as primary client-side storage for documents and large data
- localStorage as fallback for smaller data and preferences
- Auto-save mechanism with debouncing to reduce unnecessary writes
- Sync queue pattern for eventual consistency with backend when online

### Backend Architecture

**Node.js + Express Server**
- Lightweight Express 5.x server serving static files and API endpoints
- RESTful API design for AI operations
- Stateless server design - all persistence handled client-side or via external services
- Request size limit of 50MB to support image and file uploads

**API Endpoints (Secure Server Proxy)**
- `/api/generate` - Text generation using Gemini AI with optional system instructions
- `/api/analyze-image` - Image analysis using Gemini Vision capabilities  
- `/api/generate-title` - Automatic title generation for documents
- `/api/chat` - Multi-turn conversation with file attachment support (PDFs, images)

**AI Integration Pattern**
- Server-side Gemini API calls to protect API keys
- Support for multiple Gemini API keys (separate keys for editor, chat, transcription, file analysis)
- Model selection based on task: `gemini-2.5-flash` for text, `gemini-2.5-pro` for vision
- Structured prompt engineering with system instructions for consistent AI behavior

### External Dependencies

**Google Gemini AI API**
- Primary AI service for all intelligent features
- Multiple API keys supported for rate limiting and separation of concerns
- Models used:
  - `gemini-2.5-flash` - Text generation, document organization, spell-checking
  - `gemini-2.5-pro` - Image analysis, complex reasoning tasks
- Features leveraged: text generation, multimodal input (text + images), system instructions

**Client-Side Storage**
- **IndexedDB** - Primary structured storage for documents, transcriptions, and large files
- **localStorage** - Fallback storage and user preferences
- **File System Access API** (future consideration) - For direct file system integration

**Planned External Cloud Storage Options**
- Google Drive API - OAuth integration for user-owned storage
- Dropbox API - Alternative cloud storage option
- OneDrive API - Microsoft cloud storage integration
- AWS S3 / Cloud Storage - Object storage via presigned URLs
- IPFS - Decentralized storage option (optional)

**Audio Processing**
- Web Audio API - For real-time audio recording
- MediaRecorder API - Audio capture in browser
- Language support: Portuguese (PT), English (EN), Spanish (ES)

**Dependencies (package.json)**
- `@google/genai` ^1.29.1 - Official Google Generative AI SDK
- `express` ^5.1.0 - Web server framework
- `@types/node` ^22.13.11 - TypeScript definitions for Node.js

**Configuration Management**
- **SECURITY**: API keys stored ONLY in server environment variables (`process.env.GEMINI_API_KEY`)
- Never exposed to client-side code
- Secure server proxy pattern protects credentials
- Single API key used for all features (simplificado para melhor segurança)

**Development & Deployment**
- Server runs on port 5000 (webview enabled)
- Client-side storage (IndexedDB) for offline functionality
- Minimal backend dependencies (Express + Gemini SDK only)
- Ready for deployment on Replit or similar platforms
- Architecture supports serverless deployment with edge functions

## Recent Changes (Nov 2024)

### Complete Redesign
- Implementado menu hamburguer responsivo (3 barras) com animações suaves
- Editor completamente redesenhado com estilo minimalista (inspirado em write-box)
- Chat movido para página separada e dedicada
- Página de documentos criada para listar e gerenciar textos salvos
- Correção de bugs críticos na integração com Gemini API (acesso correto aos candidates)

### Security Improvements
- API keys movidas para servidor (variáveis de ambiente)
- Removido config.json com chaves expostas
- Implementado padrão de proxy seguro para todas as chamadas de IA