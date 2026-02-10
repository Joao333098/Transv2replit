const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Middleware
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple JSON Database for persistence
const DB_PATH = path.join(__dirname, 'database.json');
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ files: [] }, null, 2));
}

function getDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Load config
let config = { gemini: { editor: '', chat: '', transcription: '', fileAnalysis: '' } };
try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (error) {
    console.error('Erro ao carregar config.json:', error);
}

// Initialize Gemini AI with separate keys
const editorKey = config.gemini.editor || process.env.GEMINI_EDITOR_KEY || '';
const chatKey = config.gemini.chat || process.env.GEMINI_CHAT_KEY || '';
const transcriptionKey = config.gemini.transcription || process.env.GEMINI_TRANSCRIPTION_KEY || '';
const fileAnalysisKey = config.gemini.fileAnalysis || process.env.GEMINI_FILE_ANALYSIS_KEY || '';

const aiEditor = editorKey ? new GoogleGenAI({ apiKey: editorKey }) : null;
const aiChat = chatKey ? new GoogleGenAI({ apiKey: chatKey }) : null;
const aiTranscription = transcriptionKey ? new GoogleGenAI({ apiKey: transcriptionKey }) : null;
const aiFileAnalysis = fileAnalysisKey ? new GoogleGenAI({ apiKey: fileAnalysisKey }) : null;

// API Routes

// File Management Routes
app.post('/api/files/upload', upload.array('files'), (req, res) => {
    console.log('Recebendo requisição de upload...');
    console.log('Arquivos recebidos:', req.files ? req.files.length : 0);
    try {
        if (!req.files || req.files.length === 0) {
            console.log('Nenhum arquivo enviado na requisição');
            return res.status(400).json({ error: 'Nenhum arquivo enviado' });
        }
        const db = getDB();
        const savedFiles = [];
        for (const file of req.files) {
            const fileInfo = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                name: file.originalname,
                size: file.size,
                type: file.mimetype,
                path: file.path,
                uploadDate: new Date().toISOString()
            };
            db.files.push(fileInfo);
            savedFiles.push(fileInfo);
        }
        saveDB(db);
        res.json({ success: true, files: savedFiles });
    } catch (error) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: 'Erro ao fazer upload dos arquivos' });
    }
});

app.get('/api/files', (req, res) => {
    try {
        const db = getDB();
        res.json(db.files.slice().reverse());
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: 'Erro ao buscar arquivos' });
    }
});

app.delete('/api/files/:id', (req, res) => {
    try {
        const db = getDB();
        const id = parseInt(req.params.id);
        const fileIndex = db.files.findIndex(f => f.id === id);
        
        if (fileIndex !== -1) {
            const file = db.files[fileIndex];
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
            db.files.splice(fileIndex, 1);
            saveDB(db);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Arquivo não encontrado' });
        }
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Erro ao excluir arquivo' });
    }
});

app.get('/api/files/download/:id', (req, res) => {
    try {
        const db = getDB();
        const id = parseInt(req.params.id);
        const file = db.files.find(f => f.id === id);
        
        if (file && fs.existsSync(file.path)) {
            const absolutePath = path.resolve(file.path);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
            res.sendFile(absolutePath);
        } else {
            res.status(404).json({ error: 'Arquivo não encontrado' });
        }
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ error: 'Erro ao baixar arquivo' });
    }
});

// Generate content with Gemini (Editor)
app.post('/api/generate', async (req, res) => {
    try {
        if (!aiEditor) return res.status(500).json({ error: 'Editor API key não configurada' });
        const { prompt, systemInstruction, useThinking = true, temperature = 0.7 } = req.body;
        const config = { temperature, topP: 0.95, topK: 40 };
        if (systemInstruction) config.systemInstruction = systemInstruction;
        if (!useThinking) config.thinkingConfig = { thinkingBudget: 0 };

        const response = await aiEditor.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ text });
    } catch (error) {
        console.error('Error generating content:', error);
        res.status(500).json({ error: 'Erro ao gerar conteúdo com IA' });
    }
});

// Analyze image with Gemini (File Analysis)
app.post('/api/analyze-image', async (req, res) => {
    try {
        if (!aiFileAnalysis) return res.status(500).json({ error: 'File Analysis API key não configurada' });
        const { imageData, mimeType, prompt } = req.body;
        const response = await aiFileAnalysis.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { data: imageData, mimeType: mimeType || 'image/jpeg' } },
                    { text: prompt || 'Descreva esta imagem em detalhes.' }
                ]
            }]
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ text });
    } catch (error) {
        console.error('Error analyzing image:', error);
        res.status(500).json({ error: 'Erro ao analisar imagem' });
    }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, files, useThinking = false, useSearch = false, temperature = 0.9 } = req.body;
        if (!aiChat) return res.status(500).json({ error: 'Chat API key não configurada' });
        
        const contents = [];
        if (history && Array.isArray(history)) {
            for (const item of history) {
                if (item.parts && Array.isArray(item.parts)) {
                    const validParts = item.parts.filter(part => (part.text && part.text.trim()) || (part.inlineData && part.inlineData.data));
                    if (validParts.length > 0) contents.push({ role: item.role, parts: validParts });
                }
            }
        }

        const currentParts = [];
        if (files && Array.isArray(files)) {
            for (const file of files) {
                if (file.data && file.mimeType) {
                    const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
                    if (base64Data && base64Data.trim()) {
                        currentParts.push({ inlineData: { mimeType: file.mimeType, data: base64Data } });
                    }
                }
            }
        }
        if (message && message.trim()) currentParts.push({ text: message });
        if (currentParts.length > 0) contents.push({ role: 'user', parts: currentParts });
        if (contents.length === 0) return res.status(400).json({ error: 'Mensagem vazia' });

        const config = { temperature, topP: 0.95, topK: 40 };
        if (!useThinking) config.thinkingConfig = { thinkingBudget: 0 };
        if (useSearch) config.tools = [{ googleSearch: {} }];

        const result = await aiChat.models.generateContent({ 
            model: 'gemini-2.5-flash',
            contents,
            config
        });

        const candidate = result.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text || 'Sem resposta';
        let thinking = '';
        if (candidate?.content?.parts) {
            const thinkingPart = candidate.content.parts.find(part => part.thought);
            if (thinkingPart) thinking = thinkingPart.thought;
        }
        res.json({ response: text, thinking });
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação: ' + error.message });
    }
});

// Process live transcription
app.post('/api/transcription/process', async (req, res) => {
    try {
        if (!aiTranscription) return res.status(500).json({ error: 'Transcription API key não configurada' });
        const { text, language, action, useThinking = false, useSearch = false, targetLang = null } = req.body;
        if (!text || text.trim().length === 0) return res.status(400).json({ error: 'Texto vazio' });

        const langMap = { 'pt-BR': 'português brasileiro', 'en-US': 'inglês americano', 'es-ES': 'espanhol' };
        const currentLang = langMap[language] || 'português';
        let prompt = `Ação: ${action}. Texto: ${text}`;
        
        const config = { temperature: 0.7 };
        if (!useThinking) config.thinkingConfig = { thinkingBudget: 0 };
        if (useSearch) config.tools = [{ googleSearch: {} }];

        const response = await aiTranscription.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config
        });

        const candidate = response.candidates?.[0];
        const resultText = candidate?.content?.parts?.[0]?.text || '';
        let thinking = '';
        if (candidate?.content?.parts) {
            const thinkingPart = candidate.content.parts.find(part => part.thought);
            if (thinkingPart) thinking = thinkingPart.thought;
        }
        res.json({ text: resultText, thinking });
    } catch (error) {
        console.error('Error processing transcription:', error);
        res.status(500).json({ error: 'Erro ao processar transcrição' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
