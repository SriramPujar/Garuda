import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

export const maxDuration = 30;
export const runtime = 'nodejs';

// Initialize Groq
const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY || '',
});

// Helper for Ollama proxy
async function proxyOllama(messages: any[]) {
    const ollamaMessages = messages.map((m: any) => ({
        role: m.role,
        content: getMessageContent(m),
    }));

    const response = await fetch(process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'llama3',
            messages: ollamaMessages,
            stream: true,
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama error: ${await response.text()}`);
    }

    return response.body;
}

// Helper to manually parse Ollama stream and convert to AI SDK compatible/simple stream
// OR basically just pipe raw for our manual client
function createOllamaStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
        async start(controller) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n').filter(l => l.trim() !== '');
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.message?.content) {
                                controller.enqueue(encoder.encode(json.message.content));
                            }
                            if (json.done) {
                                controller.close();
                                return;
                            }
                        } catch (e) { }
                    }
                }
                controller.close();
            } catch (e) { controller.error(e); }
        }
    });
}

import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

let cachedVectorStore: any = null;

function loadVectorStore() {
    if (cachedVectorStore) return cachedVectorStore;
    try {
        const filePath = path.join(process.cwd(), 'data', 'vector_store.json');
        const data = fs.readFileSync(filePath, 'utf8');
        cachedVectorStore = JSON.parse(data);
    } catch (e) {
        console.warn("No vector store found. RAG disabled.");
        cachedVectorStore = [];
    }
    return cachedVectorStore;
}

function cosineSimilarity(A: number[], B: number[]) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < A.length; i++) {
        dotProduct += A[i] * B[i];
        normA += A[i] * A[i];
        normB += B[i] * B[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
    const { messages, filter, sessionId, title } = await req.json();
    const sessionUser = await getServerSession(authOptions);
    const userId = sessionUser?.user?.id;

    const systemPrompt = `You are Garuda — a wise and compassionate spiritual guide deeply versed in the sacred teachings of the **Bhagavad Gita**, **Uddhava Gita**, and **Shrimad Bhagavatam**. You embody the loving wisdom of Krishna's teachings and speak with clarity, depth, and reverence.

# Your Sacred Duty

Answer philosophical and spiritual questions posed by seekers by drawing **exclusively** from the retrieved scriptural passages provided to you in the context below. Do not invent or fabricate verses. If the retrieved context does not address the question directly, acknowledge this humbly and offer related wisdom.

# Response Style & Structure

Analyze the complexity and depth of the user's question to determine your answer length and format:
1. **Short/Conversational (1-3 sentences):** For greetings, simple facts, or clarifications. Keep it warm and direct.
2. **Medium (1-2 paragraphs):** For moderate questions requiring a clear, concise explanation of a specific teaching.
3. **In-depth (Comprehensive):** For deep philosophical inquiries or complex life problems. Break down the answer logically and comprehensively.

Format guidelines:
- Start warmly with "Hare Rama! 🙏" (unless continuing an ongoing conversation naturally).
- Weave the retrieved scriptural passages smoothly into your answer. Explain any Sanskrit terms you use.
- Relate the ancient wisdom to the user's modern context in a practical way.
- Do NOT use rigid block headers like "Teaching:" or "Practical Wisdom:". Let the conversation flow organically to suit the question.
- **References:** At the very end of your response, list your sources. For EACH source PDF you drew from, output it on its own line in this exact format: [Source: filename.pdf].

---
Hare Krishna! 🙏
`;


    // ── Smart RAG: Cloud (Qdrant + HF) or Local (Ollama + JSON) ──
    let contextText = '';
    try {
        const lastMessage = getMessageContent(messages[messages.length - 1]);
        if (!lastMessage) throw new Error('No message');

        const isCloud = !!process.env.HF_API_KEY;

        // ── Embed the query ──────────────────────────────────────
        let queryVector: number[] | null = null;

        if (isCloud) {
            // Production: Hugging Face Inference API (free)
            console.log('RAG: Embedding via Hugging Face...');
            const hfRes = await fetch(
                'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.HF_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ inputs: lastMessage, options: { wait_for_model: true } }),
                }
            );
            if (hfRes.ok) {
                const hfData = await hfRes.json();
                // HF returns a nested array for batch input — unwrap first item
                queryVector = Array.isArray(hfData[0]) ? hfData[0] : hfData;
            }
        } else {
            // Local: Ollama nomic-embed-text
            console.log('RAG: Embedding via Ollama...');
            const embRes = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'nomic-embed-text', prompt: lastMessage }),
            });
            if (embRes.ok) {
                const embData = await embRes.json();
                queryVector = embData.embedding;
            }
        }

        if (!queryVector) throw new Error('Failed to generate embedding');

        // ── Search the vector store ──────────────────────────────
        const filterMap: Record<string, string[]> = {
            bg:         ['bhagavad', 'gita-as-it-is', 'gita_as_it_is'],
            uddhava:    ['uddhava'],
            bhagavatam: ['bhagavata', 'bhagavatam', 'mahapurana'],
        };

        if (isCloud) {
            // Production: Neon pgvector similarity search
            console.log('RAG: Searching Neon pgvector...');
            
            const embeddingLiteral = `[${queryVector.join(',')}]`;
            let hits: any[] = [];

            // Apply source filter if not 'all'
            if (filter && filter !== 'all' && filterMap[filter]) {
                const keywords = filterMap[filter];
                const likeConds = keywords.map((kw: string) => `source ILIKE '%${kw}%'`).join(' OR ');
                
                hits = await prisma.$queryRawUnsafe(`
                    SELECT source, text, 1 - (embedding <=> $1::vector) as similarity
                    FROM "Scripture"
                    WHERE ${likeConds}
                    ORDER BY embedding <=> $1::vector
                    LIMIT 6
                `, embeddingLiteral);
            } else {
                hits = await prisma.$queryRawUnsafe(`
                    SELECT source, text, 1 - (embedding <=> $1::vector) as similarity
                    FROM "Scripture"
                    ORDER BY embedding <=> $1::vector
                    LIMIT 6
                `, embeddingLiteral);
            }

            contextText = hits
                .map((h: any) => `[Source: ${h.source}]\n${h.text}`)
                .join('\n\n');
            console.log(`RAG: Retrieved ${hits.length} passages from pgvector.`);
        } else {
            // Local: in-memory cosine similarity over vector_store.json
            console.log('RAG: Searching local vector store...');
            const vs = loadVectorStore();
            if (vs && vs.length > 0) {
                const filteredVs = (filter && filter !== 'all' && filterMap[filter])
                    ? vs.filter((v: any) => filterMap[filter].some((kw: string) => v.source.toLowerCase().includes(kw)))
                    : vs;

                const scored = filteredVs.map((v: any) => ({
                    ...v,
                    score: cosineSimilarity(queryVector!, v.embedding),
                }));
                scored.sort((a: any, b: any) => b.score - a.score);
                const topChunks = scored.slice(0, 6);
                contextText = topChunks.map((c: any) => `[Source: ${c.source}]\n${c.text}`).join('\n\n');
                console.log(`RAG: Retrieved ${topChunks.length} passages from local store.`);
            }
        }
    } catch (e) {
        console.error('RAG Failure:', e);
    }


    const finalSystemPrompt = systemPrompt + (contextText ? `\n\n# RETRIEVED SCRIPTURAL CONTEXT\nThe following passages from the sacred texts have been retrieved based on the user's query. Use ONLY this information to construct your answer:\n\n${contextText}` : '');

    // Insert System Prompt
    const fullMessages = [
        { role: 'system', content: finalSystemPrompt },
        ...messages
    ];

    // Helper to persist to DB
    const persistChat = async (aiContent: string) => {
        if (!userId) return;
        try {
            // Find or create session
            let dbSession = await prisma.session.findUnique({ where: { id: sessionId } });
            if (!dbSession) {
                dbSession = await prisma.session.create({
                    data: {
                        id: sessionId,
                        userId: userId,
                        title: title || 'New Chat'
                    }
                });
            }
            // Save User Message (last one in messages array)
            const userMsg = messages[messages.length - 1];
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    role: 'user',
                    content: getMessageContent(userMsg)
                }
            });
            // Save AI Message
            await prisma.message.create({
                data: {
                    sessionId: dbSession.id,
                    role: 'assistant',
                    content: aiContent
                }
            });
        } catch (err) {
            console.error('Failed to log message:', err);
        }
    };

    // Try Groq if Key exists
    if (process.env.GROQ_API_KEY) {
        try {
            const result = streamText({
                model: groq('llama-3.3-70b-versatile'), // Defaulting to high quality Groq model
                messages: fullMessages,
                onFinish: async ({ text }) => {
                    await persistChat(text);
                }
            });
            return result.toTextStreamResponse({ headers: CORS_HEADERS });
        } catch (e) {
            console.error('Groq Error, falling back to Ollama', e);
        }
    }

    // Fallback to Ollama (Direct Proxy)
    try {
        const body = await proxyOllama(fullMessages);
        if (!body) throw new Error('No body from Ollama');

        const reader = body.getReader();
        const stream = createOllamaStream(reader);
        return new Response(stream, { headers: CORS_HEADERS });

    } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500, headers: CORS_HEADERS });
    }
}

function getMessageContent(m: any) {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) {
        return m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    }
    return '';
}
