import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';
import fs from 'fs';
import path from 'path';

// Static imports of Canto JSON datasets to force Next.js compilation bundling
import canto1 from './bhagavatam/canto_1.json';
import canto2 from './bhagavatam/canto_2.json';
import canto3 from './bhagavatam/canto_3.json';
import canto4 from './bhagavatam/canto_4.json';
import canto5 from './bhagavatam/canto_5.json';
import canto6 from './bhagavatam/canto_6.json';
import canto7 from './bhagavatam/canto_7.json';
import canto8 from './bhagavatam/canto_8.json';
import canto9 from './bhagavatam/canto_9.json';
import canto10 from './bhagavatam/canto_10.json';
import canto11 from './bhagavatam/canto_11.json';
import canto12 from './bhagavatam/canto_12.json';

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

const CANTO_DATA: Record<number, any[]> = {
    1: canto1,
    2: canto2,
    3: canto3,
    4: canto4,
    5: canto5,
    6: canto6,
    7: canto7,
    8: canto8,
    9: canto9,
    10: canto10,
    11: canto11,
    12: canto12
};

// Retrieve a Srimad Bhagavatam verse by Canto, Chapter, and Verse
function getBhagavatamVerse(canto: number, chapter: number, verse: number) {
    const rows = CANTO_DATA[canto];
    if (!rows || rows.length === 0) return null;
    
    // 1. Direct try
    const directMatch = rows.find((r: any) => r.chapter === chapter && r.verse === verse);
    if (directMatch) {
        return {
            match: directMatch,
            actualCanto: canto,
            actualChapter: chapter,
            actualVerse: verse
        };
    }

    // 2. Next verse check (in case they went past the last verse of a chapter)
    if (verse > 1) {
        const nextChapterMatch = rows.find((r: any) => r.chapter === chapter + 1 && r.verse === 1);
        if (nextChapterMatch) {
            return {
                match: nextChapterMatch,
                actualCanto: canto,
                actualChapter: chapter + 1,
                actualVerse: 1
            };
        }
        
        // 3. Next canto check (if they went past the last verse of the last chapter of the canto)
        const nextCantoRows = CANTO_DATA[canto + 1];
        if (nextCantoRows && nextCantoRows.length > 0) {
            return {
                match: nextCantoRows[0],
                actualCanto: canto + 1,
                actualChapter: nextCantoRows[0].chapter,
                actualVerse: nextCantoRows[0].verse
            };
        }
    }

    // Fallback: return the first verse of that chapter or Canto
    const chRows = rows.filter((r: any) => r.chapter === chapter);
    if (chRows.length > 0) {
        return {
            match: chRows[0],
            actualCanto: canto,
            actualChapter: chapter,
            actualVerse: chRows[0].verse
        };
    }
    
    return {
        match: rows[0],
        actualCanto: canto,
        actualChapter: rows[0].chapter,
        actualVerse: rows[0].verse
    };
}

// Retrieve an Uddhava Gita verse by Chapter and Verse
function getUddhavaVerse(chapter: number, verse: number) {
    const targetCanto = 11;
    const targetChapter = chapter + 5; // Uddhava Gita Chapter 1 = Canto 11, Chapter 6

    const rows = CANTO_DATA[targetCanto];
    if (!rows || rows.length === 0) return null;
    
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

    return null;
}

// Determine writable cache directory path depending on production/local environment
function getGitaCacheDir(): string {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
    if (isVercel) {
        return path.join('/tmp', 'bg_cache');
    }
    return path.join(process.cwd(), 'data', 'bg_cache');
}

// Fetch Bhagavad Gita verse from cache/Hugging Face
async function fetchGitaVerse(chapter: number, verse: number): Promise<{ sanskrit: string; translation: string; citation: string; actualChapter: number; actualVerse: number } | null> {
    const cacheDir = getGitaCacheDir();
    if (!fs.existsSync(cacheDir)) {
        try {
            fs.mkdirSync(cacheDir, { recursive: true });
        } catch (err) {
            console.error("Failed to create BG cache directory:", err);
        }
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
            try {
                fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
            } catch (writeErr) {
                console.error("Failed to write BG cache file:", writeErr);
            }
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
                try {
                    fs.writeFileSync(nextCachePath, JSON.stringify(data, null, 2), 'utf8');
                } catch (writeErr) {
                    console.error("Failed to write BG next chapter cache file:", writeErr);
                }
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
        const { scripture, chapter, verse, canto, subChapter } = await req.json();
        
        let loadedSanskrit = '';
        let loadedTranslation = '';
        let citation = '';
        let actualCanto = canto || chapter || 1;
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
                loadedTranslation = res.match.translation || `Direct study verse from the Purana. (Transliteration: ${res.match.transliteration})`;
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
            const targetCanto = canto || chapter || 1;
            const targetChapter = subChapter || 1;
            const targetVerse = verse || 1;
            
            // If subChapter is not defined, treat it as the old sequential lookup
            const hasSubChapter = typeof subChapter !== 'undefined' && subChapter !== null;
            
            let res;
            if (hasSubChapter) {
                res = getBhagavatamVerse(targetCanto, targetChapter, targetVerse);
            } else {
                // Sequential fallback: find row at index (targetVerse - 1)
                const rows = CANTO_DATA[targetCanto];
                if (rows && rows.length > 0) {
                    const safeIdx = Math.min(rows.length, Math.max(1, targetVerse)) - 1;
                    const match = rows[safeIdx];
                    res = {
                        match,
                        actualCanto: targetCanto,
                        actualChapter: match.chapter,
                        actualVerse: match.verse
                    };
                }
            }
            
            if (res) {
                loadedSanskrit = `${res.match.sanskrit}\n\n[Transliteration]\n${res.match.transliteration}`;
                loadedTranslation = res.match.translation || `Direct study verse from the Bhagavatam Purana. (Transliteration: ${res.match.transliteration})`;
                actualCanto = res.actualCanto;
                actualChapter = res.actualChapter;
                actualVerse = res.actualVerse;
                citation = `Srimad Bhagavatam Canto ${res.actualCanto}, Chapter ${res.actualChapter}, Verse ${res.actualVerse}`;
            } else {
                loadedSanskrit = `|| Srimad Bhagavatam Canto ${targetCanto}, Verse ${targetVerse} ||`;
                loadedTranslation = `Study passage for Srimad Bhagavatam Canto ${targetCanto}.`;
                citation = `Srimad Bhagavatam Canto ${targetCanto}, Verse ${targetVerse}`;
            }
        }

        // Generate summary dynamically based on retrieved Sanskrit & translation
        const summary = await generateSummary(citation, loadedSanskrit, loadedTranslation);

        const responseData = {
            sanskrit: loadedSanskrit,
            translation: loadedTranslation,
            summary,
            citation,
            actualCanto,
            actualChapter,
            actualVerse
        };

        return Response.json(responseData, { headers: CORS_HEADERS });
    } catch (e: any) {
        console.error("Scripture API Error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
}
