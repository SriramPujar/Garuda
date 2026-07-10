import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export const maxDuration = 30;

interface ScriptureResponse {
    sanskrit: string;
    translation: string;
    summary: string;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Robust JSON parse helper
function cleanAndParseJSON(text: string): ScriptureResponse {
    let cleaned = text.trim();
    
    // Extract JSON block between first '{' and last '}'
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    try {
        return JSON.parse(cleaned);
    } catch (e: any) {
        // Try fixing common trailing comma errors or key quote mismatches
        try {
            const fixed = cleaned
                .replace(/,\s*([\]}])/g, '$1')
                .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":');
            return JSON.parse(fixed);
        } catch (err2: any) {
            throw new Error(`Failed to parse LLM JSON: ${e.message}`);
        }
    }
}

// Ollama fallback query helper
async function queryOllama(activeScriptName: string, chapter: number, verse: number, systemPrompt: string): Promise<ScriptureResponse> {
    const url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api/chat';
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: process.env.OLLAMA_MODEL || 'llama3',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Please retrieve ${activeScriptName} Chapter ${chapter}, Verse ${verse} matching instructions.` }
            ],
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama response error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.message?.content || '';
    return cleanAndParseJSON(content);
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
    let reqScripture = 'bg';
    let reqChapter = 1;
    let reqVerse = 1;

    try {
        const body = await req.json();
        reqScripture = body.scripture || 'bg';
        reqChapter = body.chapter || 1;
        reqVerse = body.verse || 1;
    } catch (err) {
        console.error("Failed to parse body params:", err);
    }

    const scriptureNames: Record<string, string> = {
        bg: 'Bhagavad Gita',
        uddhava: 'Uddhava Gita',
        bhagavatam: 'Shrimad Bhagavatam'
    };
    const activeScriptName = scriptureNames[reqScripture] || 'Bhagavad Gita';
    const unitsName = reqScripture === 'bhagavatam' ? 'Canto' : 'Chapter';

    // 1. Establish the dynamic fallback to display the correct book/chapter/verse even if AI is unavailable
    const dynamicFallback: ScriptureResponse = {
        sanskrit: `|| ${activeScriptName} ${unitsName} ${reqChapter}, Verse ${reqVerse} ||`,
        translation: `Direct translation and meaning for ${activeScriptName} ${unitsName} ${reqChapter}, Verse ${reqVerse} is loading. Please configure the GROQ_API_KEY in your server configuration settings or verify your network connection to stream full Sanskrit details.`,
        summary: `Self-realization passage in ${activeScriptName} ${unitsName} ${reqChapter}.`
    };

    const systemPrompt = `You are Garuda — a wise scriptural lookup system.
The user wants to read: "${activeScriptName}" Chapter ${reqChapter}, Verse ${reqVerse} (or Canto ${reqChapter}, Chapter ${reqVerse} if Shrimad Bhagavatam).
Please retrieve the correct Sanskrit text, direct English translation, and a brief 1-2 sentence core message summary for this specific verse.

CRITICAL: Return ONLY a raw JSON block. Do not wrap in markdown or backticks.
Schema:
{
  "sanskrit": "Sanskrit text (Devanagari if possible, with English transliteration below)",
  "translation": "Direct English translation of the verse",
  "summary": "Core spiritual takeaway of this verse"
}
`;

    // 2. Try Groq
    if (process.env.GROQ_API_KEY) {
        try {
            const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
            const { text } = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                prompt: `Please retrieve ${activeScriptName} Chapter ${reqChapter}, Verse ${reqVerse} matching instructions.`,
                system: systemPrompt,
            });

            const parsed = cleanAndParseJSON(text);
            if (parsed.sanskrit && parsed.translation) {
                return Response.json(parsed, { headers: CORS_HEADERS });
            }
        } catch (groqErr) {
            console.error("Groq Scripture Fetch Error, trying Ollama fallback...", groqErr);
        }
    }

    // 3. Try Ollama (for local dev fallback)
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) {
        try {
            const parsed = await queryOllama(activeScriptName, reqChapter, reqVerse, systemPrompt);
            if (parsed.sanskrit && parsed.translation) {
                return Response.json(parsed, { headers: CORS_HEADERS });
            }
        } catch (ollamaErr) {
            console.error("Ollama Scripture Fetch Error, falling back to dynamic template...", ollamaErr);
        }
    }

    // 4. Return dynamic fallback so the user always sees the correct book, chapter, and verse they clicked on
    return Response.json(dynamicFallback, { headers: CORS_HEADERS });
}
