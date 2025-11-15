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
        
        // New chat button
        document.getElementById('new-chat-btn')?.addEventListener('click', () => this.newChat());
        
        // History button
        document.getElementById('chat-history-btn')?.addEventListener('click', () => this.showChatHistory());

        this.loadHistory();
    }

    newChat() {
        if (this.messages.length > 0) {
            this.saveChatToHistory();
        }
        this.clearChat();
    }

    async saveChatToHistory() {
        const chatHistory = JSON.parse(localStorage.getItem('chat-history') || '[]');
        chatHistory.unshift({
            messages: this.messages,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        });
        
        if (chatHistory.length > 50) chatHistory.splice(50);
        localStorage.setItem('chat-history', JSON.stringify(chatHistory));
    }

    showChatHistory() {
        const chatHistory = JSON.parse(localStorage.getItem('chat-history') || '[]');
        
        if (chatHistory.length === 0) {
            alert('Nenhum histórico de chat encontrado.');
            return;
        }
        
        const historyHtml = chatHistory.map((item, index) => `
            <div class="history-item-card" onclick="chat.loadChatFromHistory(${index})">
                <div class="history-item-header">
                    <strong>Conversa ${index + 1}</strong>
                    <span style="font-size: 12px; color: var(--text-tertiary);">${item.date}</span>
                </div>
                <div class="history-item-preview">${item.messages[0]?.content.substring(0, 100)}...</div>
            </div>
        `).join('');
        
        // Show in modal or sidebar
        alert('Histórico:\n\n' + chatHistory.map((h, i) => `${i + 1}. ${h.date}`).join('\n'));
    }

    loadChatFromHistory(index) {
        const chatHistory = JSON.parse(localStorage.getItem('chat-history') || '[]');
        const item = chatHistory[index];
        
        if (!item) return;
        
        this.messages = item.messages;
        this.renderMessages();
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
                this.addMessage('ai', data.response, data.thinking);
            }
        } catch (error) {
            console.error('Erro no chat:', error);
            this.addMessage('ai', 'Desculpe, ocorreu um erro. Tente novamente.');
        } finally {
            this.sendBtn.disabled = false;
        }
    }

    addMessage(role, content, thinking = null) {
        // Remove welcome message
        const welcome = this.messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // Add message
        this.messages.push({ role, content });

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (role === 'ai' && thinking && thinking.trim()) {
            const thinkingId = 'main-chat-thinking-' + Date.now();
            messageDiv.innerHTML = `
                <div class="thinking-container" id="container-${thinkingId}">
                    <button class="thinking-toggle" onclick="document.getElementById('container-${thinkingId}').classList.toggle('expanded')">
                        <span class="thinking-icon">⟩</span>
                        <span class="thinking-label">Pensamento</span>
                    </button>
                    <div class="thinking-content" id="${thinkingId}">
                        ${thinking.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="message-text">${content.replace(/\n/g, '<br>')}</div>
                <div class="message-actions">
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${content.replace(/'/g, "\\'")}'); this.textContent='✓ Copiado!';">📋 Copiar</button>
                </div>
            `;
        } else {
            const escapedContent = content.replace(/'/g, "\\'");
            messageDiv.innerHTML = `
                <div>${content}</div>
                <div class="message-actions">
                    <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapedContent}'); this.innerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><polyline points=\\'20 6 9 17 4 12\\'/></svg> Copiado!';">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copiar
                    </button>
                </div>
            `;
        }
        
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

        // Live translation toggle
        document.getElementById('live-translation-toggle')?.addEventListener('change', (e) => {
            const panel = document.getElementById('live-translation-panel');
            panel.style.display = e.target.checked ? 'block' : 'none';
        });

        // Translation modal
        document.getElementById('close-translation-modal')?.addEventListener('click', () => {
            document.getElementById('translation-modal').style.display = 'none';
        });

        document.querySelectorAll('.translation-tool-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handleTranslationTool(btn.dataset.tool));
        });

        // Word hover for AI context
        this.transcriptText.addEventListener('mouseup', (e) => this.handleWordSelection(e));

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
        
        // Apply highlight markers
        this.applyHighlightMarkers();
        
        // Live translation
        if (document.getElementById('live-translation-toggle')?.checked) {
            this.translateLive(final);
        }
        
        // Auto-detect questions
        this.detectQuestions(final);
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

    openTranslationModal() {
        document.getElementById('translation-modal').style.display = 'flex';
    }

    async handleAIAction(action) {
        const transcript = this.currentTranscript.trim();
        if (!transcript) {
            alert('Não há transcrição para processar!');
            return;
        }

        // Aplicar marcadores (converter **texto** em destaque)
        this.applyHighlightMarkers();

        // Get toggle states
        const useThinking = document.getElementById('transcript-thinking-toggle')?.checked || false;
        const useSearch = document.getElementById('transcript-search-toggle')?.checked || false;

        // Get target language for translation
        let targetLang = null;
        if (action === 'translate') {
            targetLang = document.getElementById('translate-target-lang').value;
        }

        try {
            // Disable all buttons during processing
            const buttons = document.querySelectorAll('.ai-tool-btn');
            buttons.forEach(btn => btn.disabled = true);
            
            this.aiResponse.innerHTML = '<div style="text-align: center; color: var(--accent-color);">🤖 Processando...</div>';

            const response = await fetch('/api/transcription/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcript,
                    language: this.languageSelect.value,
                    action,
                    useThinking,
                    useSearch,
                    targetLang
                })
            });

            const data = await response.json();
            
            if (data.error) {
                this.aiResponse.innerHTML = `<div style="color: var(--error-color);">❌ Erro: ${data.error}</div>`;
            } else if (data.result) {
                // Format result based on action
                let formattedResult = data.result;
                
                if (action === 'keywords' || action === 'topics' || action === 'entities') {
                    // Format lists better
                    formattedResult = formattedResult.replace(/\n/g, '<br>');
                } else if (action === 'action-items') {
                    formattedResult = formattedResult.replace(/\n/g, '<br>');
                } else {
                    formattedResult = formattedResult.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
                    formattedResult = '<p>' + formattedResult + '</p>';
                }
                
                // Display thinking if present
                let thinkingHtml = '';
                if (data.thinking && data.thinking.trim()) {
                    const thinkingId = 'thinking-' + Date.now();
                    thinkingHtml = `
                        <div class="thinking-container" id="container-${thinkingId}">
                            <button class="thinking-toggle" onclick="document.getElementById('container-${thinkingId}').classList.toggle('expanded')">
                                <span class="thinking-icon">⟩</span>
                                <span class="thinking-label">Pensamento do Gemini</span>
                            </button>
                            <div class="thinking-content" id="${thinkingId}">
                                ${data.thinking.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                }
                
                this.aiResponse.innerHTML = thinkingHtml + formattedResult;
                
                // Save to history
                this.saveToAIToolHistory(action, formattedResult, data.thinking);
            } else {
                this.aiResponse.innerHTML = '<div style="color: var(--text-tertiary);">Sem resultado</div>';
            }
        } catch (error) {
            console.error('Erro:', error);
            this.aiResponse.innerHTML = `<div style="color: var(--error-color);">❌ Erro ao processar: ${error.message}</div>`;
        } finally {
            // Re-enable buttons
            const buttons = document.querySelectorAll('.ai-tool-btn');
            buttons.forEach(btn => btn.disabled = false);
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
                this.addChatMessage('ai', data.response, data.thinking);
            }
        } catch (error) {
            console.error('Error in chat:', error);
            this.addChatMessage('ai', 'Erro ao processar sua pergunta: ' + error.message);
        }
    }

    addChatMessage(role, content, thinking = null) {
        const messagesContainer = document.getElementById('transcript-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (role === 'ai' && thinking && thinking.trim()) {
            const thinkingId = 'chat-thinking-' + Date.now();
            messageDiv.innerHTML = `
                <div class="thinking-container" id="container-${thinkingId}">
                    <button class="thinking-toggle" onclick="document.getElementById('container-${thinkingId}').classList.toggle('expanded')">
                        <span class="thinking-icon">⟩</span>
                        <span class="thinking-label">Pensamento</span>
                    </button>
                    <div class="thinking-content" id="${thinkingId}">
                        ${thinking.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="message-text">${content.replace(/\n/g, '<br>')}</div>
            `;
        } else {
            messageDiv.textContent = content;
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.chatMessages.push({ role, content });
    }

    saveToAIToolHistory(action, result, thinking) {
        const historyKey = 'ai-tool-history';
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        history.unshift({
            action,
            result,
            thinking,
            timestamp: Date.now(),
            date: new Date().toLocaleString()
        });
        
        // Keep only last 50 items
        if (history.length > 50) {
            history.splice(50);
        }
        
        localStorage.setItem(historyKey, JSON.stringify(history));
    }

    showAIToolHistory() {
        const historyKey = 'ai-tool-history';
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        if (history.length === 0) {
            alert('Nenhum histórico de ferramentas AI encontrado.');
            return;
        }
        
        const actionNames = {
            'improve': 'Melhorar Texto',
            'summarize': 'Resumir',
            'keywords': 'Palavras-chave',
            'questions': 'Gerar Perguntas',
            'translate': 'Traduzir',
            'topics': 'Identificar Tópicos',
            'sentiment': 'Análise de Sentimento',
            'entities': 'Entidades',
            'action-items': 'Itens de Ação',
            'minutes': 'Ata de Reunião'
        };
        
        const historyHtml = history.map((item, index) => `
            <div class="history-item-card" onclick="transcription.loadFromAIToolHistory(${index})">
                <div class="history-item-header">
                    <strong>${actionNames[item.action] || item.action}</strong>
                    <span style="font-size: 12px; color: var(--text-tertiary);">${item.date}</span>
                </div>
                <div class="history-item-preview">${item.result.substring(0, 100)}...</div>
            </div>
        `).join('');
        
        this.aiResponse.innerHTML = `
            <div style="margin-bottom: 16px;">
                <button class="btn-small" onclick="transcription.clearAIToolResponse()" style="margin-right: 8px;">← Voltar</button>
                <button class="btn-small" onclick="transcription.clearAIToolHistory()">Limpar Histórico</button>
            </div>
            <div class="history-grid">${historyHtml}</div>
        `;
    }

    loadFromAIToolHistory(index) {
        const historyKey = 'ai-tool-history';
        const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        const item = history[index];
        
        if (!item) return;
        
        let thinkingHtml = '';
        if (item.thinking && item.thinking.trim()) {
            const thinkingId = 'history-thinking-' + Date.now();
            thinkingHtml = `
                <div class="thinking-container" id="container-${thinkingId}">
                    <button class="thinking-toggle" onclick="document.getElementById('container-${thinkingId}').classList.toggle('expanded')">
                        <span class="thinking-icon">⟩</span>
                        <span class="thinking-label">Pensamento do Gemini</span>
                    </button>
                    <div class="thinking-content" id="${thinkingId}">
                        ${item.thinking.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }
        
        this.aiResponse.innerHTML = `
            <div style="margin-bottom: 16px;">
                <button class="btn-small" onclick="transcription.showAIToolHistory()">← Voltar ao Histórico</button>
            </div>
            ${thinkingHtml}
            ${item.result}
        `;
    }

    clearAIToolResponse() {
        this.aiResponse.innerHTML = '';
    }

    clearAIToolHistory() {
        if (confirm('Deseja realmente limpar todo o histórico de ferramentas AI?')) {
            localStorage.removeItem('ai-tool-history');
            this.aiResponse.innerHTML = '';
            alert('Histórico limpo com sucesso!');
        }
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

    // Dicionário offline expandido
    getDictionary() {
        return {
            'pt-en': {
                // Palavras comuns
                'olá': 'hello', 'oi': 'hi', 'tchau': 'bye', 'adeus': 'goodbye',
                'bom': 'good', 'dia': 'day', 'tarde': 'afternoon', 'noite': 'night',
                'obrigado': 'thank you', 'obrigada': 'thank you', 'por favor': 'please',
                'sim': 'yes', 'não': 'no', 'talvez': 'maybe',
                'hoje': 'today', 'ontem': 'yesterday', 'amanhã': 'tomorrow',
                'agora': 'now', 'depois': 'later', 'antes': 'before',
                // Verbos
                'ser': 'to be', 'estar': 'to be', 'ter': 'to have', 'fazer': 'to do/make',
                'ir': 'to go', 'vir': 'to come', 'ver': 'to see', 'dar': 'to give',
                'saber': 'to know', 'poder': 'can/may', 'querer': 'to want',
                // Substantivos
                'casa': 'house', 'trabalho': 'work', 'escola': 'school', 'família': 'family',
                'amigo': 'friend', 'amor': 'love', 'tempo': 'time/weather', 'vida': 'life',
                'mundo': 'world', 'pessoa': 'person', 'coisa': 'thing', 'lugar': 'place',
                'reunião': 'meeting', 'projeto': 'project', 'tarefa': 'task'
            },
            'pt-es': {
                'olá': 'hola', 'oi': 'hola', 'tchau': 'adiós', 'adeus': 'adiós',
                'bom': 'bueno', 'dia': 'día', 'tarde': 'tarde', 'noite': 'noche',
                'obrigado': 'gracias', 'obrigada': 'gracias', 'por favor': 'por favor',
                'sim': 'sí', 'não': 'no', 'talvez': 'quizás',
                'hoje': 'hoy', 'ontem': 'ayer', 'amanhã': 'mañana',
                'casa': 'casa', 'trabalho': 'trabajo', 'escola': 'escuela', 'família': 'familia',
                'reunião': 'reunión', 'projeto': 'proyecto', 'tarefa': 'tarea'
            },
            'en-pt': {
                'hello': 'olá', 'hi': 'oi', 'bye': 'tchau', 'goodbye': 'adeus',
                'good': 'bom', 'day': 'dia', 'afternoon': 'tarde', 'night': 'noite',
                'thank you': 'obrigado', 'please': 'por favor',
                'yes': 'sim', 'no': 'não', 'maybe': 'talvez',
                'today': 'hoje', 'yesterday': 'ontem', 'tomorrow': 'amanhã',
                'house': 'casa', 'work': 'trabalho', 'school': 'escola', 'family': 'família',
                'meeting': 'reunião', 'project': 'projeto', 'task': 'tarefa'
            }
        };
    }

    // Handle translation modal tools
    async handleTranslationTool(tool) {
        const word = document.getElementById('translation-word-input').value.trim();
        const sourceLang = document.getElementById('translation-source-lang').value;
        const targetLang = document.getElementById('translation-target-lang-modal').value;
        const resultArea = document.getElementById('translation-result');

        if (!word) {
            resultArea.innerHTML = '<div class="translation-placeholder"><p>Digite uma palavra primeiro</p></div>';
            return;
        }

        const dict = this.getDictionary();
        const dictKey = `${sourceLang}-${targetLang}`;
        const lowerWord = word.toLowerCase();

        let result = '';

        switch (tool) {
            case 'translate':
                const translation = dict[dictKey]?.[lowerWord] || 'Tradução não encontrada';
                result = `<div class="translation-result-item"><strong>Tradução:</strong> ${translation}</div>`;
                break;

            case 'synonyms':
                const synonyms = {
                    'bom': ['ótimo', 'excelente', 'positivo', 'agradável'],
                    'casa': ['residência', 'lar', 'moradia', 'domicílio'],
                    'trabalho': ['emprego', 'ocupação', 'serviço', 'labor']
                };
                const syns = synonyms[lowerWord] || ['Não encontrado'];
                result = `<div class="translation-result-item"><strong>Sinônimos:</strong><ul>${syns.map(s => `<li>${s}</li>`).join('')}</ul></div>`;
                break;

            case 'antonyms':
                const antonyms = {
                    'bom': ['ruim', 'mal', 'negativo'],
                    'sim': ['não'],
                    'hoje': ['ontem', 'amanhã']
                };
                const ants = antonyms[lowerWord] || ['Não encontrado'];
                result = `<div class="translation-result-item"><strong>Antônimos:</strong><ul>${ants.map(a => `<li>${a}</li>`).join('')}</ul></div>`;
                break;

            case 'definition':
                const definitions = {
                    'casa': 'Edifício destinado à habitação; residência, lar.',
                    'trabalho': 'Atividade profissional; emprego, ocupação.',
                    'amor': 'Sentimento de afeição profunda; carinho.'
                };
                const def = definitions[lowerWord] || 'Definição não disponível offline.';
                result = `<div class="translation-result-item"><strong>Definição:</strong><p>${def}</p></div>`;
                break;

            case 'examples':
                const examples = {
                    'casa': ['Eu vou para casa.', 'Minha casa é grande.'],
                    'trabalho': ['Vou ao trabalho de manhã.', 'O trabalho está difícil.']
                };
                const exs = examples[lowerWord] || ['Exemplos não disponíveis'];
                result = `<div class="translation-result-item"><strong>Exemplos:</strong><ul>${exs.map(e => `<li>${e}</li>`).join('')}</ul></div>`;
                break;

            case 'conjugation':
                result = `<div class="translation-result-item"><strong>Conjugação:</strong><p>Presente: ${lowerWord}o, ${lowerWord}s, ${lowerWord}</p></div>`;
                break;

            case 'plural':
                const plural = lowerWord.endsWith('s') ? lowerWord : lowerWord + 's';
                result = `<div class="translation-result-item"><strong>Plural:</strong> ${plural}</div>`;
                break;

            case 'pronunciation':
                result = `<div class="translation-result-item"><strong>Pronúncia (IPA):</strong> /${lowerWord}/</div>`;
                break;

            case 'idioms':
                result = `<div class="translation-result-item"><strong>Expressões:</strong><p>Expressões idiomáticas não disponíveis offline.</p></div>`;
                break;

            case 'related':
                result = `<div class="translation-result-item"><strong>Palavras Relacionadas:</strong><p>Palavras relacionadas não disponíveis offline.</p></div>`;
                break;
        }

        resultArea.innerHTML = result;
    }

    // Live translation - Offline dictionary-based
    async translateLive(text) {
        const targetLang = document.getElementById('live-translation-lang').value;
        const translationPanel = document.getElementById('live-translation-text');
        
        const dict = this.getDictionary();
        const dictKey = `pt-${targetLang.split('-')[0]}`;
        
        if (!dict[dictKey]) {
            translationPanel.innerHTML = text.replace(/\n/g, '<br>');
            return;
        }

        // Tradução palavra por palavra
        const words = text.toLowerCase().split(/\s+/);
        const translated = words.map(word => {
            const cleanWord = word.replace(/[.,!?;:]/g, '');
            return dict[dictKey][cleanWord] || word;
        });

        translationPanel.innerHTML = translated.join(' ').replace(/\n/g, '<br>');
    }

    // Auto-detect questions using NLP
    async detectQuestions(text) {
        if (!document.getElementById('auto-detect-questions-toggle')?.checked) return;
        
        try {
            const response = await fetch('/api/transcription/detect-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            
            const data = await response.json();
            if (data.questions && data.questions.length > 0) {
                // Auto-answer detected questions
                for (const question of data.questions) {
                    await this.autoAnswerQuestion(question);
                }
            }
        } catch (error) {
            console.error('Error detecting questions:', error);
        }
    }

    async autoAnswerQuestion(question) {
        const messagesContainer = document.getElementById('transcript-chat-messages');
        
        // Add question to chat
        const questionDiv = document.createElement('div');
        questionDiv.className = 'message user';
        questionDiv.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px; vertical-align: middle;">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
            </svg>
            <span>Detectado: ${question}</span>
        `;
        messagesContainer.appendChild(questionDiv);
        
        // Get answer
        try {
            const response = await fetch('/api/transcription/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: question,
                    transcriptContext: this.currentTranscript,
                    history: this.chatMessages
                })
            });
            
            const data = await response.json();
            this.addChatMessage('ai', data.response, data.thinking);
        } catch (error) {
            console.error('Error answering question:', error);
        }
    }

    // Word hover with AI context
    handleWordSelection(event) {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && selectedText.split(' ').length <= 5) {
            this.showWordHoverTooltip(event, selectedText);
        }
    }

    showWordHoverTooltip(event, word) {
        // Remove existing tooltip
        const existingTooltip = document.querySelector('.word-hover-tooltip');
        if (existingTooltip) existingTooltip.remove();
        
        const tooltip = document.createElement('div');
        tooltip.className = 'word-hover-tooltip';
        tooltip.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <span>Enviar para AI</span>
        `;
        tooltip.style.left = event.pageX + 'px';
        tooltip.style.top = (event.pageY - 40) + 'px';
        
        tooltip.addEventListener('click', () => {
            this.analyzeWordWithAI(word);
            tooltip.remove();
        });
        
        document.body.appendChild(tooltip);
        
        // Remove after 5 seconds
        setTimeout(() => tooltip.remove(), 5000);
    }

    async analyzeWordWithAI(word) {
        try {
            const response = await fetch('/api/transcription/analyze-word', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    word,
                    context: this.currentTranscript
                })
            });
            
            const data = await response.json();
            if (data.analysis) {
                this.addChatMessage('ai', `Análise de "${word}": ${data.analysis}`);
            }
        } catch (error) {
            console.error('Error analyzing word:', error);
        }
    }

    // Apply highlight markers (convert **text** to highlighted text)
    applyHighlightMarkers() {
        const content = this.transcriptText.innerHTML;
        const highlighted = content.replace(/\*\*(.*?)\*\*/g, '<span class="highlight-marker">$1</span>');
        this.transcriptText.innerHTML = highlighted;
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