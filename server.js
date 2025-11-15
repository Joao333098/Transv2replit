const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

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

if (!editorKey || !chatKey || !transcriptionKey || !fileAnalysisKey) {
    console.error('⚠️  Algumas GEMINI_API_KEYs não estão configuradas!');
    console.error('📝 Edite o arquivo config.json e cole suas chaves da API do Gemini');
    console.error('🔑 Obtenha suas chaves em: https://aistudio.google.com/apikey');
}

const aiEditor = editorKey ? new GoogleGenAI({ apiKey: editorKey }) : null;
const aiChat = chatKey ? new GoogleGenAI({ apiKey: chatKey }) : null;
const aiTranscription = transcriptionKey ? new GoogleGenAI({ apiKey: transcriptionKey }) : null;
const aiFileAnalysis = fileAnalysisKey ? new GoogleGenAI({ apiKey: fileAnalysisKey }) : null;

// API Routes

// Generate content with Gemini (Editor) - with thinking mode and advanced configs
app.post('/api/generate', async (req, res) => {
    try {
        if (!aiEditor) {
            return res.status(500).json({ error: 'Editor API key não configurada' });
        }

        const { prompt, systemInstruction, useThinking = true, temperature = 0.7 } = req.body;

        const config = {
            temperature,
            topP: 0.95,
            topK: 40
        };

        if (systemInstruction) {
            config.systemInstruction = systemInstruction;
        }

        // Configure thinking mode (disabled by default for faster responses)
        if (!useThinking) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

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
        if (!aiFileAnalysis) {
            return res.status(500).json({ error: 'File Analysis API key não configurada' });
        }

        const { imageData, mimeType, prompt } = req.body;

        const response = await aiFileAnalysis.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: [{
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            data: imageData,
                            mimeType: mimeType || 'image/jpeg'
                        }
                    },
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

// Generate title for document
app.post('/api/generate-title', async (req, res) => {
    try {
        const { content } = req.body;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                role: 'user',
                parts: [{
                    text: `Com base no seguinte texto, sugira um título curto (máximo 50 caracteres) e descritivo. Responda APENAS com o título, sem explicações:\n\n${content.substring(0, 500)}`
                }]
            }]
        });

        const title = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        res.json({ title });
    } catch (error) {
        console.error('Error generating title:', error);
        res.status(500).json({ error: 'Erro ao gerar título' });
    }
});

// Chat endpoint with file support, thinking mode and search grounding
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history, files, useThinking = false, useSearch = false, temperature = 0.9 } = req.body;

        if (!aiChat) {
            return res.status(500).json({ error: 'Chat API key não configurada' });
        }

        const model = aiChat.models;

        // Build contents array
        const contents = [];

        // Add history (filter out empty parts)
        if (history && Array.isArray(history)) {
            for (const item of history) {
                if (item.parts && Array.isArray(item.parts)) {
                    const validParts = item.parts.filter(part => {
                        // Keep text parts that are not empty
                        if (part.text && part.text.trim()) return true;
                        // Keep inlineData parts that have data
                        if (part.inlineData && part.inlineData.data) return true;
                        return false;
                    });

                    if (validParts.length > 0) {
                        contents.push({
                            role: item.role,
                            parts: validParts
                        });
                    }
                }
            }
        }

        // Build current message parts
        const currentParts = [];

        // Add files first
        if (files && Array.isArray(files)) {
            for (const file of files) {
                if (file.data && file.mimeType) {
                    // Remove data URL prefix if present
                    const base64Data = file.data.includes(',') 
                        ? file.data.split(',')[1] 
                        : file.data;

                    // Only add if we have actual data
                    if (base64Data && base64Data.trim()) {
                        currentParts.push({
                            inlineData: {
                                mimeType: file.mimeType,
                                data: base64Data
                            }
                        });
                    }
                }
            }
        }

        // Add text message
        if (message && message.trim()) {
            currentParts.push({ text: message });
        }

        // Add current message to contents only if we have parts
        if (currentParts.length > 0) {
            contents.push({
                role: 'user',
                parts: currentParts
            });
        }

        // Make sure we have at least one content item
        if (contents.length === 0) {
            return res.status(400).json({ error: 'Mensagem vazia' });
        }

        // Advanced configuration
        const config = {
            temperature,
            topP: 0.95,
            topK: 40
        };

        // Configure thinking mode
        if (!useThinking) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        // Configure Google Search grounding
        if (useSearch) {
            config.tools = [{
                googleSearch: {}
            }];
        }

        const result = await model.generateContent({ 
            model: 'gemini-2.5-flash',
            contents,
            config
        });

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta';
        res.json({ response: text });
    } catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Erro ao processar solicitação: ' + error.message });
    }
});

// Transcription endpoints

// Process live transcription with NLP - Enhanced with thinking mode and structured outputs
app.post('/api/transcription/process', async (req, res) => {
    try {
        if (!aiTranscription) {
            return res.status(500).json({ error: 'Transcription API key não configurada' });
        }

        const { text, language, action, useThinking = false, useSearch = false, targetLang = null } = req.body;

        // Validação
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Texto vazio' });
        }

        if (!action) {
            return res.status(400).json({ error: 'Ação não especificada' });
        }

        // Mapear idiomas
        const langMap = {
            'pt-BR': 'português brasileiro',
            'en-US': 'inglês americano',
            'es-ES': 'espanhol',
            'fr-FR': 'francês',
            'de-DE': 'alemão',
            'it-IT': 'italiano',
            'ja-JP': 'japonês',
            'zh-CN': 'chinês simplificado'
        };

        const currentLang = langMap[language] || 'português';
        let prompt = '';
        const systemInstruction = `Você é um assistente especializado em processamento de linguagem natural e análise de transcrições. 
        Responda sempre em ${currentLang}, sendo preciso e objetivo.`;

        const config = {
            systemInstruction,
            temperature: 0.3,
            topP: 0.95,
            topK: 40
        };

        // Disable thinking for faster responses by default
        if (!useThinking) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        // Apply search grounding if enabled
        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        switch (action) {
            case 'improve':
                prompt = `Melhore o seguinte texto corrigindo erros gramaticais, ortográficos e de pontuação. Torne-o mais claro e fluido, mantendo o significado original:\n\n${text}`;
                break;
            
            case 'summarize':
                prompt = `Crie um resumo detalhado e bem estruturado do seguinte texto. Organize em tópicos principais se houver vários assuntos:\n\n${text}`;
                break;
            
            case 'keywords':
                prompt = `Extraia as palavras-chave e conceitos mais importantes do texto. Liste em formato de bullet points, do mais relevante ao menos relevante:\n\n${text}`;
                break;
            
            case 'questions':
                prompt = `Gere 5 perguntas relevantes e importantes baseadas no conteúdo do texto. As perguntas devem testar a compreensão dos pontos principais:\n\n${text}`;
                break;
            
            case 'translate':
                if (!targetLang) {
                    return res.status(400).json({ error: 'Idioma de destino não especificado' });
                }
                const targetLanguage = langMap[targetLang] || 'inglês';
                prompt = `Traduza o seguinte texto para ${targetLanguage} de forma natural e fluente:\n\n${text}`;
                config.temperature = 0.2; // Mais determinístico para traduções
                break;
            
            case 'topics':
                prompt = `Identifique e liste os principais tópicos e temas discutidos no texto. Organize em categorias se aplicável:\n\n${text}`;
                break;
            
            case 'sentiment':
                prompt = `Analise o sentimento geral do texto (positivo, neutro ou negativo). Explique sua análise e cite trechos específicos que justificam sua conclusão:\n\n${text}`;
                break;
            
            case 'entities':
                prompt = `Identifique e liste de forma organizada:\n- Pessoas mencionadas\n- Lugares\n- Organizações/Empresas\n- Datas e eventos importantes\n\nTexto:\n${text}`;
                break;
            
            case 'action-items':
                prompt = `Extraia todos os itens de ação, tarefas, compromissos e decisões mencionados no texto. Liste em formato de checklist:\n\n${text}`;
                break;
            
            case 'minutes':
                prompt = `Crie uma ata de reunião profissional e bem formatada com as seguintes seções:\n1. Participantes (se mencionados)\n2. Tópicos Discutidos\n3. Decisões Tomadas\n4. Itens de Ação\n5. Próximos Passos\n\nBasear na transcrição:\n${text}`;
                break;
            
            default:
                return res.status(400).json({ error: 'Ação não reconhecida: ' + action });
        }

        const response = await aiTranscription.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config
        });

        // Melhor tratamento de erros
        if (!response || !response.candidates || response.candidates.length === 0) {
            return res.status(500).json({ error: 'Nenhuma resposta gerada pela IA' });
        }

        const result = response.candidates[0]?.content?.parts?.[0]?.text || '';
        
        if (!result || result.trim().length === 0) {
            return res.status(500).json({ error: 'Resposta vazia da IA' });
        }

        res.json({ result });
    } catch (error) {
        console.error('Error processing transcription:', error);
        res.status(500).json({ error: 'Erro ao processar transcrição: ' + error.message });
    }
});

// Chat with transcription - Enhanced with thinking and search
app.post('/api/transcription/chat', async (req, res) => {
    try {
        if (!aiTranscription) {
            return res.status(500).json({ error: 'Transcription API key não configurada' });
        }

        const { message, transcriptContext, history, useThinking = false, useSearch = false } = req.body;

        const contents = [];

        // Add history
        if (history && Array.isArray(history)) {
            history.forEach(msg => {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            });
        }

        // Add current message with context
        const contextualPrompt = transcriptContext 
            ? `Contexto da transcrição:\n${transcriptContext}\n\nPergunta do usuário: ${message}`
            : message;

        contents.push({
            role: 'user',
            parts: [{ text: contextualPrompt }]
        });

        const config = {
            temperature: 0.7,
            topP: 0.95
        };

        // Configure thinking mode
        if (!useThinking) {
            config.thinkingConfig = { thinkingBudget: 0 };
        }

        // Configure Google Search grounding
        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const response = await aiTranscription.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config
        });

        const result = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ response: result });
    } catch (error) {
        console.error('Error in transcription chat:', error);
        res.status(500).json({ error: 'Erro no chat de transcrição' });
    }
});

// Real-time transcription enhancement
app.post('/api/transcription/enhance-realtime', async (req, res) => {
    try {
        if (!aiTranscription) {
            return res.status(500).json({ error: 'Transcription API key não configurada' });
        }

        const { partialText, language } = req.body;

        const prompt = `Corrija apenas erros óbvios de gramática neste texto parcial de transcrição, mantendo o máximo possível do texto original:\n\n${partialText}`;

        const response = await aiTranscription.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                temperature: 0.1, // Baixa temperatura para correções mais conservadoras
                maxOutputTokens: 1024
            }
        });

        const enhanced = response.candidates?.[0]?.content?.parts?.[0]?.text || partialText;
        res.json({ enhanced });
    } catch (error) {
        console.error('Error enhancing realtime transcription:', error);
        res.json({ enhanced: req.body.partialText }); // Retorna o texto original em caso de erro
    }
});

        // Main route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ Servidor rodando na porta ${PORT}`);
    console.log('📝 Writebox - Editor Inteligente');
    
    const keysConfigured = {
        editor: !!editorKey,
        chat: !!chatKey,
        transcription: !!transcriptionKey,
        fileAnalysis: !!fileAnalysisKey
    };
    
    const allConfigured = Object.values(keysConfigured).every(k => k);
    
    if (allConfigured) {
        console.log('✓ Todas as chaves Gemini API configuradas');
    } else {
        console.log('⚠️  Algumas chaves Gemini API não configuradas:');
        if (!keysConfigured.editor) console.log('  - Editor');
        if (!keysConfigured.chat) console.log('  - Chat');
        if (!keysConfigured.transcription) console.log('  - Transcrição');
        if (!keysConfigured.fileAnalysis) console.log('  - Análise de Arquivos');
        console.log('📝 Configure as chaves em config.json');
    }
});