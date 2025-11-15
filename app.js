// Gerenciador de navegação
class NavigationManager {
    constructor() {
        this.hamburger = document.getElementById('hamburger-btn');
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('menu-overlay');
        this.navItems = document.querySelectorAll('.nav-item');
        this.pages = document.querySelectorAll('.page');

        this.init();
    }

    init() {
        // Toggle menu
        this.hamburger.addEventListener('click', () => {
            this.toggleMenu();
        });

        this.overlay.addEventListener('click', () => {
            this.closeMenu();
        });

        // Navegação entre páginas
        this.navItems.forEach(item => {
            item.addEventListener('click', () => {
                const pageName = item.dataset.page;
                this.navigateTo(pageName);
                this.closeMenu();
            });
        });
    }

    toggleMenu() {
        this.sidebar.classList.toggle('active');
        this.overlay.classList.toggle('active');
        this.hamburger.classList.toggle('active');
    }

    closeMenu() {
        this.sidebar.classList.remove('active');
        this.overlay.classList.remove('active');
        this.hamburger.classList.remove('active');
    }

    navigateTo(pageName) {
        // Update active nav item
        this.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        // Update active page
        this.pages.forEach(page => {
            page.classList.toggle('active', page.id === `${pageName}-page`);
        });
    }
}

// IndexedDB Manager
class StorageManager {
    constructor() {
        this.dbName = 'WriteboxDB';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('transcriptions')) {
                    db.createObjectStore('transcriptions', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('chatHistory')) {
                    db.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async save(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, id) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        return store.delete(id);
    }
}

// Editor Manager
class EditorManager {
    constructor(storage) {
        this.storage = storage;
        this.editor = document.getElementById('editor');
        this.titleInput = document.getElementById('doc-title');
        this.wordCount = document.getElementById('word-count');
        this.charCount = document.getElementById('char-count');
        this.saveStatus = document.getElementById('save-status');
        this.currentDoc = null;
        this.autoSaveTimeout = null;

        this.init();
    }

    init() {
        // Carrega último documento
        this.loadLastDocument();

        // Auto-save
        this.editor.addEventListener('input', () => {
            this.updateStats();
            this.scheduleAutoSave();
        });

        this.titleInput.addEventListener('input', () => {
            this.scheduleAutoSave();
        });

        // Botões
        document.getElementById('new-doc-btn').addEventListener('click', () => this.newDocument());
        document.getElementById('save-btn').addEventListener('click', () => this.save(true));
        document.getElementById('organize-btn').addEventListener('click', () => this.organizeText());
    }

    updateStats() {
        const text = this.editor.innerText;
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;

        this.wordCount.textContent = `${words} palavras`;
        this.charCount.textContent = `${chars} caracteres`;
    }

    scheduleAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.save();
        }, 2000);
    }

    async save(manual = false) {
        const content = this.editor.innerHTML;
        let title = this.titleInput.value.trim();

        // Gerar título automaticamente se vazio
        if (!title && content.length > 10) {
            try {
                const response = await fetch('/api/generate-title', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: this.editor.innerText })
                });
                const data = await response.json();
                title = data.title || 'Sem título';
                this.titleInput.value = title;
            } catch (error) {
                console.error('Erro ao gerar título:', error);
                title = 'Sem título';
            }
        } else if (!title) {
            title = 'Sem título';
        }

        const doc = {
            id: this.currentDoc?.id,
            title,
            content,
            lastModified: new Date().toISOString()
        };

        try {
            const id = await this.storage.save('documents', doc);
            if (!this.currentDoc) {
                this.currentDoc = { ...doc, id };
            }
            this.showSaveStatus(manual ? 'Salvo!' : 'Salvo automaticamente', true);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            this.showSaveStatus('Erro ao salvar', false);
        }
    }

    async loadLastDocument() {
        const docs = await this.storage.getAll('documents');
        if (docs.length > 0) {
            const lastDoc = docs[docs.length - 1];
            this.loadDocument(lastDoc);
        }
    }

    loadDocument(doc) {
        this.currentDoc = doc;
        this.titleInput.value = doc.title;
        this.editor.innerHTML = doc.content;
        this.updateStats();
    }

    newDocument() {
        if (confirm('Criar novo documento? As alterações não salvas serão perdidas.')) {
            this.currentDoc = null;
            this.titleInput.value = '';
            this.editor.innerHTML = '';
            this.updateStats();
        }
    }

    async organizeText() {
        const content = this.editor.innerText.trim();
        if (!content) {
            alert('Escreva algo antes de organizar!');
            return;
        }

        this.showSaveStatus('Organizando...', true);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Organize, corrija erros gramaticais e ortográficos, e melhore a estrutura deste texto. Mantenha o significado original:\n\n${content}`,
                    systemInstruction: 'Você é um assistente de escrita profissional.'
                })
            });

            const data = await response.json();
            if (data.text) {
                this.editor.innerHTML = data.text.replace(/\n/g, '<br>');
                this.save(true);
                this.showSaveStatus('Texto organizado!', true);
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showSaveStatus('Erro ao organizar', false);
        }
    }

    showSaveStatus(message, isSuccess) {
        this.saveStatus.textContent = message;
        this.saveStatus.className = 'save-status' + (isSuccess ? ' success' : '');
        setTimeout(() => {
            this.saveStatus.textContent = '';
        }, 3000);
    }
}

// Documents List Manager
class DocumentsManager {
    constructor(storage, editorManager, navigationManager) {
        this.storage = storage;
        this.editorManager = editorManager;
        this.navigationManager = navigationManager;
        this.grid = document.getElementById('documents-grid');
        this.searchInput = document.getElementById('search-docs');

        this.init();
    }

    init() {
        this.searchInput.addEventListener('input', (e) => {
            this.render(e.target.value);
        });

        // Atualizar lista quando a página de documentos for aberta
        const docsNavItem = document.querySelector('[data-page="documents"]');
        docsNavItem.addEventListener('click', () => {
            this.render();
        });
    }

    async render(searchQuery = '') {
        const docs = await this.storage.getAll('documents');
        let filtered = docs.reverse();

        if (searchQuery) {
            filtered = filtered.filter(doc =>
                doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                doc.content.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        if (filtered.length === 0) {
            this.grid.innerHTML = '<div class="empty-state-dark"><p>Nenhum documento encontrado</p></div>';
            return;
        }

        this.grid.innerHTML = filtered.map(doc => `
            <div class="doc-card" data-id="${doc.id}">
                <div class="doc-card-title">${doc.title}</div>
                <div class="doc-card-preview">${this.getPreview(doc.content)}</div>
                <div class="doc-card-meta">
                    <span>${new Date(doc.lastModified).toLocaleDateString()}</span>
                    <span>${this.getWordCount(doc.content)} palavras</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        this.grid.querySelectorAll('.doc-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                this.openDocument(id);
            });
        });
    }

    async openDocument(id) {
        const doc = await this.storage.get('documents', id);
        if (doc) {
            this.editorManager.loadDocument(doc);
            this.navigationManager.navigateTo('editor');
        }
    }

    getPreview(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.innerText.substring(0, 150) + '...';
    }

    getWordCount(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.innerText.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
}

// Chat Manager
class ChatManager {
    constructor(storage) {
        this.storage = storage;
        this.messagesContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('send-btn');
        this.attachBtn = document.getElementById('attach-btn');
        this.fileInput = document.getElementById('chat-file-input');
        this.clearBtn = document.getElementById('clear-chat-btn');
        this.messages = [];
        this.attachedFiles = [];

        this.init();
    }

    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.attachBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileAttach(e));
        this.clearBtn.addEventListener('click', () => this.clearChat());

        this.loadHistory();
    }

    async sendMessage() {
        const text = this.chatInput.value.trim();
        if (!text && this.attachedFiles.length === 0) return;

        // Add user message
        this.addMessage('user', text);
        this.chatInput.value = '';

        // Prepare API request
        const files = await Promise.all(this.attachedFiles.map(async file => ({
            data: await this.fileToBase64(file),
            mimeType: file.type
        })));

        this.attachedFiles = [];

        // Get toggle states
        const useThinking = document.getElementById('chat-thinking-toggle')?.checked || false;
        const useSearch = document.getElementById('chat-search-toggle')?.checked || false;

        try {
            this.sendBtn.disabled = true;
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: this.messages.slice(0, -1).map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    })),
                    files,
                    useThinking,
                    useSearch
                })
            });

            const data = await response.json();
            if (data.error) {
                this.addMessage('ai', 'Erro: ' + data.error);
            } else {
                this.addMessage('ai', data.response);
            }
        } catch (error) {
            console.error('Erro no chat:', error);
            this.addMessage('ai', 'Desculpe, ocorreu um erro. Tente novamente.');
        } finally {
            this.sendBtn.disabled = false;
        }
    }

    addMessage(role, content) {
        // Remove welcome message
        const welcome = this.messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // Add message
        this.messages.push({ role, content });

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.textContent = content;
        this.messagesContainer.appendChild(messageDiv);

        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

        // Save to storage
        this.saveHistory();
    }

    async handleFileAttach(event) {
        const files = Array.from(event.target.files);
        this.attachedFiles.push(...files);

        alert(`${files.length} arquivo(s) anexado(s): ${files.map(f => f.name).join(', ')}`);
    }

    fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });
    }

    clearChat() {
        if (confirm('Limpar toda a conversa?')) {
            this.messages = [];
            this.messagesContainer.innerHTML = `
                <div class="chat-welcome">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h2>Como posso ajudar?</h2>
                    <p>Envie mensagens, PDFs, fotos e faça perguntas!</p>
                </div>
            `;
            this.saveHistory();
        }
    }

    async saveHistory() {
        await this.storage.save('chatHistory', {
            id: 1,
            messages: this.messages,
            lastModified: new Date().toISOString()
        });
    }

    async loadHistory() {
        const history = await this.storage.get('chatHistory', 1);
        if (history && history.messages && history.messages.length > 0) {
            this.messages = history.messages;
            this.renderMessages();
        }
    }

    renderMessages() {
        const welcome = this.messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        this.messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.role}`;
            messageDiv.textContent = msg.content;
            this.messagesContainer.appendChild(messageDiv);
        });
    }
}

// Files Manager
class FilesManager {
    constructor(storage) {
        this.storage = storage;
        this.uploadBtn = document.getElementById('upload-btn');
        this.fileInput = document.getElementById('file-upload');
        this.filesGrid = document.getElementById('files-grid');

        this.init();
    }

    init() {
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleUpload(e.target.files));

        // Drag and drop
        this.filesGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        this.filesGrid.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleUpload(e.dataTransfer.files);
        });

        const filesNavItem = document.querySelector('[data-page="files"]');
        filesNavItem.addEventListener('click', () => this.render());
    }

    async handleUpload(files) {
        for (const file of files) {
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                uploadDate: new Date().toISOString(),
                data: await this.fileToBase64(file)
            };

            await this.storage.save('files', fileData);
        }

        this.render();
    }

    fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    async render() {
        const files = await this.storage.getAll('files');

        if (files.length === 0) {
            this.filesGrid.innerHTML = `
                <div class="empty-state-dark">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                        <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    <p>Nenhum arquivo</p>
                    <p class="subtitle">Clique em Upload ou arraste arquivos aqui</p>
                </div>
            `;
            return;
        }

        this.filesGrid.innerHTML = files.reverse().map(file => `
            <div class="file-card" data-id="${file.id}">
                <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                </svg>
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    <span>${this.formatSize(file.size)}</span>
                </div>
            </div>
        `).join('');
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

// Transcription Manager
class TranscriptionManager {
    constructor(storage) {
        this.storage = storage;
        this.languageSelect = document.getElementById('language-select');
        this.startBtn = document.getElementById('start-recording-btn');
        this.saveBtn = document.getElementById('save-transcript-btn');
        this.exportBtn = document.getElementById('export-transcript-btn');
        this.viewHistoryBtn = document.getElementById('view-history-btn');
        this.transcriptText = document.getElementById('transcript-text');
        this.aiResponse = document.getElementById('ai-response');
        this.liveStatus = document.getElementById('live-status');
        this.recognition = null;
        this.isRecording = false;
        this.currentTranscript = '';
        this.interimTranscript = '';
        this.chatMessages = [];

        this.init();
    }

    init() {
        // Recording controls
        this.startBtn.addEventListener('click', () => this.toggleRecording());
        this.saveBtn.addEventListener('click', () => this.saveTranscript());
        this.exportBtn.addEventListener('click', () => this.exportTranscript());
        this.viewHistoryBtn.addEventListener('click', () => this.showHistory());

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
            });
        });

        // AI tools
        document.querySelectorAll('.ai-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleAIAction(btn.dataset.action));
        });

        // Chat
        document.getElementById('transcript-chat-send').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('transcript-chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // History modal
        document.getElementById('close-history-modal').addEventListener('click', () => {
            document.getElementById('history-modal').style.display = 'none';
        });

        // Setup speech recognition
        this.setupSpeechRecognition();
    }

    setupSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;

            this.recognition.onresult = async (event) => {
                let interim = '';
                let final = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        final += transcript + ' ';
                    } else {
                        interim = transcript;
                    }
                }

                if (final) {
                    this.currentTranscript += final;
                    this.updateTranscriptDisplay(this.currentTranscript, '');

                    // Auto-enhance with AI every few sentences
                    if (this.currentTranscript.split('.').length % 3 === 0) {
                        await this.enhanceRealtimeText();
                    }
                } else if (interim) {
                    this.interimTranscript = interim;
                    this.updateTranscriptDisplay(this.currentTranscript, interim);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (this.isRecording) {
                    this.toggleRecording();
                }
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    this.recognition.start();
                }
            };
        }
    }

    toggleRecording() {
        if (!this.recognition) {
            alert('Reconhecimento de voz não suportado neste navegador.');
            return;
        }

        if (this.isRecording) {
            this.recognition.stop();
            this.startBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3" fill="currentColor"/>
                </svg>
                Gravar
            `;
            this.liveStatus.style.display = 'none';
            this.isRecording = false;
        } else {
            const placeholder = this.transcriptText.querySelector('.placeholder');
            if (placeholder) placeholder.remove();

            this.recognition.lang = this.languageSelect.value;
            this.recognition.start();
            this.startBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="6" y="6" width="12" height="12"/>
                </svg>
                Parar
            `;
            this.liveStatus.style.display = 'flex';
            this.isRecording = true;
        }
    }

    updateTranscriptDisplay(final, interim) {
        const placeholder = this.transcriptText.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        this.transcriptText.innerHTML = final + 
            (interim ? `<span style="color: #999; font-style: italic;">${interim}</span>` : '');
    }

    async enhanceRealtimeText() {
        try {
            const response = await fetch('/api/transcription/enhance-realtime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partialText: this.currentTranscript,
                    language: this.languageSelect.value
                })
            });

            const data = await response.json();
            if (data.enhanced) {
                this.currentTranscript = data.enhanced;
            }
        } catch (error) {
            console.error('Error enhancing text:', error);
        }
    }

    async handleAIAction(action) {
        const transcript = this.currentTranscript.trim();
        if (!transcript) {
            alert('Não há transcrição para processar!');
            return;
        }

        // Get toggle states
        const useThinking = document.getElementById('transcript-thinking-toggle')?.checked || false;
        const useSearch = document.getElementById('transcript-search-toggle')?.checked || false;

        try {
            this.aiResponse.textContent = 'Processando...';

            const response = await fetch('/api/transcription/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcript,
                    language: this.languageSelect.value,
                    action,
                    useThinking,
                    useSearch
                })
            });

            const data = await response.json();
            if (data.error) {
                this.aiResponse.textContent = 'Erro: ' + data.error;
            } else {
                this.aiResponse.innerHTML = data.result.replace(/\n/g, '<br>') || 'Sem resultado';
            }
        } catch (error) {
            console.error('Erro:', error);
            this.aiResponse.textContent = 'Erro ao processar solicitação: ' + error.message;
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('transcript-chat-input');
        const message = input.value.trim();
        if (!message) return;

        const messagesContainer = document.getElementById('transcript-chat-messages');
        const welcome = messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // Get toggle states
        const useThinking = document.getElementById('transcript-thinking-toggle')?.checked || false;
        const useSearch = document.getElementById('transcript-search-toggle')?.checked || false;

        // Add user message
        this.addChatMessage('user', message);
        input.value = '';

        try {
            const response = await fetch('/api/transcription/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    transcriptContext: this.currentTranscript,
                    history: this.chatMessages,
                    useThinking,
                    useSearch
                })
            });

            const data = await response.json();
            if (data.error) {
                this.addChatMessage('ai', 'Erro: ' + data.error);
            } else {
                this.addChatMessage('ai', data.response);
            }
        } catch (error) {
            console.error('Error in chat:', error);
            this.addChatMessage('ai', 'Erro ao processar sua pergunta: ' + error.message);
        }
    }

    addChatMessage(role, content) {
        const messagesContainer = document.getElementById('transcript-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        messageDiv.textContent = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.chatMessages.push({ role, content });
    }

    async saveTranscript() {
        if (!this.currentTranscript.trim()) {
            alert('Não há transcrição para salvar!');
            return;
        }

        const transcript = {
            text: this.currentTranscript,
            language: this.languageSelect.value,
            date: new Date().toISOString(),
            title: `Transcrição ${new Date().toLocaleDateString()}`
        };

        try {
            await this.storage.save('transcriptions', transcript);
            alert('Transcrição salva com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar transcrição');
        }
    }

    async showHistory() {
        const modal = document.getElementById('history-modal');
        const listContainer = document.getElementById('history-list');

        const transcriptions = await this.storage.getAll('transcriptions');

        if (transcriptions.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-tertiary); padding: 40px;">Nenhuma transcrição salva</p>';
        } else {
            listContainer.innerHTML = transcriptions.reverse().map(t => `
                <div class="history-item" data-id="${t.id}">
                    <div class="history-item-header">
                        <div class="history-item-title">${t.title}</div>
                        <div class="history-item-date">${new Date(t.date).toLocaleString()}</div>
                    </div>
                    <div class="history-item-preview">${t.text.substring(0, 150)}...</div>
                    <div class="history-item-actions">
                        <button onclick="transcription.loadHistoryItem(${t.id})">Carregar</button>
                        <button onclick="transcription.deleteHistoryItem(${t.id})">Excluir</button>
                    </div>
                </div>
            `).join('');
        }

        modal.style.display = 'flex';
    }

    async loadHistoryItem(id) {
        const transcript = await this.storage.get('transcriptions', id);
        if (transcript) {
            this.currentTranscript = transcript.text;
            this.updateTranscriptDisplay(this.currentTranscript, '');
            this.languageSelect.value = transcript.language;
            document.getElementById('history-modal').style.display = 'none';
        }
    }

    async deleteHistoryItem(id) {
        if (confirm('Deseja excluir esta transcrição?')) {
            await this.storage.delete('transcriptions', id);
            this.showHistory();
        }
    }

    exportTranscript() {
        const text = this.currentTranscript;
        if (!text.trim()) {
            alert('Não há transcrição para exportar!');
            return;
        }

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcricao-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize app
(async function() {
    const storage = new StorageManager();
    await storage.init();

    const navigation = new NavigationManager();
    const editor = new EditorManager(storage);
    const documents = new DocumentsManager(storage, editor, navigation);
    const chat = new ChatManager(storage);
    const files = new FilesManager(storage);
    window.transcription = new TranscriptionManager(storage);

    console.log('✨ Writebox inicializado com sucesso!');
})();