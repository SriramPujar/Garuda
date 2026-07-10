import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';

export const maxDuration = 30;

interface ScriptureResponse {
    sanskrit: string;
    translation: string;
    summary: string;
    citation: string;
    actualChapter?: number;
    actualVerse?: number;
}

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

// Retrieve a Srimad Bhagavatam verse by Canto and sequential verse index
function getBhagavatamVerse(canto: number, verseIndex: number) {
    const jsonPath = path.join(process.cwd(), 'data', 'bhagavatam', `canto_${canto}.json`);
    if (!fs.existsSync(jsonPath)) {
        console.error("Bhagavatam Canto JSON not found at:", jsonPath);
        return null;
    }

    try {
        const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (rows.length === 0) return null;
        
        // Ensure index is within range
        const safeIndex = Math.min(rows.length, Math.max(1, verseIndex));
        const match = rows[safeIndex - 1];
        
        return {
            match,
            actualVerse: safeIndex
        };
    } catch (e) {
        console.error(`Failed to read/parse Bhagavatam Canto ${canto}:`, e);
        return null;
    }
}

// Retrieve an Uddhava Gita verse by Chapter and Verse
function getUddhavaVerse(chapter: number, verse: number) {
    const targetCanto = 11;
    const targetChapter = chapter + 5; // Uddhava Gita Chapter 1 = Canto 11, Chapter 6

    const jsonPath = path.join(process.cwd(), 'data', 'bhagavatam', `canto_${targetCanto}.json`);
    if (!fs.existsSync(jsonPath)) {
        console.error("Uddhava Canto 11 JSON not found at:", jsonPath);
        return null;
    }

    try {
        const rows = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        
        // 1. Direct try
        const directMatch = rows.find((r: any) => r.chapter === targetChapter && r.verse === verse);
        if (directMatch) {
            return {
                match: directMatch,
                actualChapter: chapter,
                actualVerse: verse
            };
        }

        // 2. boundary cross check
        if (verse > 1) {
            const nextChapterMatch = rows.find((r: any) => r.chapter === targetChapter + 1 && r.verse === 1);
            if (nextChapterMatch) {
                return {
                    match: nextChapterMatch,
                    actualChapter: chapter + 1,
                    actualVerse: 1
                };
            }
        }
    } catch (e) {
        console.error("Failed to read/parse Uddhava verse from Canto 11:", e);
    }

    return null;
}

// Fetch Bhagavad Gita verse from cache/Hugging Face
async function fetchGitaVerse(chapter: number, verse: number): Promise<{ sanskrit: string; translation: string; citation: string; actualChapter: number; actualVerse: number } | null> {
    const cacheDir = path.join(process.cwd(), 'data', 'bg_cache');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }

    const checkAndParse = (filePath: string) => {
        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                const sanskrit = `${data.slok || ''}\n\n[Transliteration]\n${data.transliteration || ''}`;
                const translation = data.siva?.et || data.purohit?.et || data.adi?.et || data.gambir?.et || '';
                return { sanskrit, translation };
            } catch (err) {
                console.error("Cache read error:", err);
            }
        }
        return null;
    };

    // 1. Direct try
    const cachePath = path.join(cacheDir, `chapter_${chapter}_slok_${verse}.json`);
    const directCached = checkAndParse(cachePath);
    if (directCached) {
        return {
            ...directCached,
            citation: `Bhagavad Gita Chapter ${chapter}, Verse ${verse}`,
            actualChapter: chapter,
            actualVerse: verse
        };
    }

    const hfUrl = `https://huggingface.co/datasets/Modotte/Bhagwat-Gita-Infinity/raw/main/slok/bhagavadgita_chapter_${chapter}_slok_${verse}.json`;
    try {
        const response = await fetch(hfUrl);
        if (response.ok) {
            const data = await response.json();
            fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
            const sanskrit = `${data.slok || ''}\n\n[Transliteration]\n${data.transliteration || ''}`;
            const translation = data.siva?.et || data.purohit?.et || data.adi?.et || data.gambir?.et || '';
            return {
                sanskrit,
                translation,
                citation: `Bhagavad Gita Chapter ${chapter}, Verse ${verse}`,
                actualChapter: chapter,
                actualVerse: verse
            };
        }
    } catch (e) {
        console.error("Failed to fetch direct Gita verse from Hugging Face:", e);
    }

    // 2. If it's a 404 (or failed), check if we ran past the chapter's end and need to go to chapter + 1, verse 1
    if (verse > 1) {
        const nextChapter = chapter + 1;
        const nextVerse = 1;
        const nextCachePath = path.join(cacheDir, `chapter_${nextChapter}_slok_${nextVerse}.json`);
        const nextCached = checkAndParse(nextCachePath);
        if (nextCached) {
            return {
                ...nextCached,
                citation: `Bhagavad Gita Chapter ${nextChapter}, Verse ${nextVerse}`,
                actualChapter: nextChapter,
                actualVerse: nextVerse
            };
        }

        const hfNextUrl = `https://huggingface.co/datasets/Modotte/Bhagwat-Gita-Infinity/raw/main/slok/bhagavadgita_chapter_${nextChapter}_slok_${nextVerse}.json`;
        try {
            const response = await fetch(hfNextUrl);
            if (response.ok) {
                const data = await response.json();
                fs.writeFileSync(nextCachePath, JSON.stringify(data, null, 2), 'utf8');
                const sanskrit = `${data.slok || ''}\n\n[Transliteration]\n${data.transliteration || ''}`;
                const translation = data.siva?.et || data.purohit?.et || data.adi?.et || data.gambir?.et || '';
                return {
                    sanskrit,
                    translation,
                    citation: `Bhagavad Gita Chapter ${nextChapter}, Verse ${nextVerse}`,
                    actualChapter: nextChapter,
                    actualVerse: nextVerse
                };
            }
        } catch (e) {
            console.error("Failed to fetch next Gita chapter start:", e);
        }
    }

    return null;
}

// Generate summary via LLM dynamically
async function generateSummary(citation: string, sanskrit: string, translation: string): Promise<string> {
    const prompt = `Scripture Citation: ${citation}
Sanskrit: ${sanskrit}
Translation: ${translation}

Please provide a brief, beautiful 1-2 sentence core message summary capturing the spiritual essence and takeaway of this verse. Do not include any introductory phrases or markdown tags. Output only the summary text directly.`;

    // Try Groq
    if (process.env.GROQ_API_KEY) {
        try {
            const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
            const { text } = await generateText({
                model: groq('llama-3.3-70b-versatile'),
                prompt,
                system: "You are Garuda, a wise Vedic sage. Extract the core message of scriptures in 1-2 sentences."
            });
            const cleaned = text.trim();
            if (cleaned) return cleaned;
        } catch (e) {
            console.error("Groq Summary generation failed, trying Ollama...", e);
        }
    }

    // Try Ollama
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_MODEL) {
        try {
            const response = await fetch(process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: process.env.OLLAMA_MODEL || 'llama3',
                    messages: [
                        { role: 'system', content: "You are Garuda, a wise Vedic sage. Extract the core message of scriptures in 1-2 sentences. Do not write markdown." },
                        { role: 'user', content: prompt }
                    ],
                    stream: false
                })
            });
            if (response.ok) {
                const data = await response.json();
                const content = data.message?.content?.trim();
                if (content) return content;
            }
        } catch (e) {
            console.error("Ollama Summary generation failed:", e);
        }
    }

    // Fallback static summary
    return `Reflect deeply on the message of this verse, letting its teachings guide your action, duty, and spiritual growth.`;
}

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
    try {
        const { scripture, chapter, verse } = await req.json();
        
        let loadedSanskrit = '';
        let loadedTranslation = '';
        let citation = '';
        let actualChapter = chapter;
        let actualVerse = verse;

        if (scripture === 'bg') {
            // ── BHAGAVAD GITA ──
            const res = await fetchGitaVerse(chapter, verse);
            if (res) {
                loadedSanskrit = res.sanskrit;
                loadedTranslation = res.translation;
                citation = res.citation;
                actualChapter = res.actualChapter;
                actualVerse = res.actualVerse;
            } else {
                // Gita fallback
                loadedSanskrit = `कर्मण्येवाधिकारस्ते मा फलेषु कदाचन |\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ||`;
                loadedTranslation = `You have a right to perform your prescribed duty, but you are not entitled to the fruits of action.`;
                citation = `Bhagavad Gita Chapter ${chapter}, Verse ${verse}`;
            }
        } else if (scripture === 'uddhava') {
            // ── UDDHAVA GITA ──
            const res = getUddhavaVerse(chapter, verse);
            if (res) {
                loadedSanskrit = `${res.match.sanskrit}\n\n[Transliteration]\n${res.match.transliteration}`;
                loadedTranslation = `Direct study verse from the Purana. (Transliteration: ${res.match.transliteration})`;
                actualChapter = res.actualChapter;
                actualVerse = res.actualVerse;
                citation = `Uddhava Gita Chapter ${actualChapter}, Verse ${actualVerse} (Srimad Bhagavatam 11.${res.match.chapter}.${res.match.verse})`;
            } else {
                // Generic fallback
                loadedSanskrit = `|| Uddhava Gita Chapter ${chapter}, Verse ${verse} ||`;
                loadedTranslation = `Study passage for Uddhava Gita. Please check scripture indexes or navigate back.`;
                citation = `Uddhava Gita Chapter ${chapter}, Verse ${verse}`;
            }
        } else if (scripture === 'bhagavatam') {
            // ── SHRIMAD BHAGAVATAM ──
            const res = getBhagavatamVerse(chapter, verse); // In Bhagavatam, Canto is passed in the "chapter" param
            
            if (res) {
                loadedSanskrit = `${res.match.sanskrit}\n\n[Transliteration]\n${res.match.transliteration}`;
                loadedTranslation = `Direct study verse from the Bhagavatam Purana. (Transliteration: ${res.match.transliteration})`;
                actualChapter = chapter;
                actualVerse = res.actualVerse;
                citation = `Srimad Bhagavatam Canto ${chapter}, Chapter ${res.match.chapter}, Verse ${res.match.verse}`;
            } else {
                loadedSanskrit = `|| Srimad Bhagavatam Canto ${chapter}, Verse ${verse} ||`;
                loadedTranslation = `Study passage for Srimad Bhagavatam Canto ${chapter}.`;
                citation = `Srimad Bhagavatam Canto ${chapter}, Verse ${verse}`;
            }
        }

        // Generate summary dynamically based on retrieved Sanskrit & translation
        const summary = await generateSummary(citation, loadedSanskrit, loadedTranslation);

        const responseData: ScriptureResponse = {
            sanskrit: loadedSanskrit,
            translation: loadedTranslation,
            summary,
            citation,
            actualChapter,
            actualVerse
        };

        return Response.json(responseData, { headers: CORS_HEADERS });
    } catch (e: any) {
        console.error("Scripture API Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
}
