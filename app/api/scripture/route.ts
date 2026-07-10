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

// Helper to parse a single CSV row with quotes and escaping support
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// In-memory cache for parsed Bhagavatam rows
interface BhagavatamRow {
    key: string;
    canto: number;
    chapter: number;
    verse: number;
    sanskrit: string;
    transliteration: string;
}

let cachedBhagavatamRows: BhagavatamRow[] | null = null;

// Determine writable CSV directory path depending on production/local environment
function getCsvPath(): string {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
    if (isVercel) {
        return path.join('/tmp', 'Shrimad_Bhagvat_Puran.csv');
    }
    return path.join(process.cwd(), 'data', 'Shrimad_Bhagvat_Puran.csv');
}

async function getBhagavatamRows(): Promise<BhagavatamRow[]> {
    if (cachedBhagavatamRows) {
        return cachedBhagavatamRows;
    }

    const csvPath = getCsvPath();
    
    // Auto-download dataset file if not present (Vercel cold start or clean dev setup)
    if (!fs.existsSync(csvPath)) {
        console.log("Bhagavatam CSV file not found. Downloading dynamically from Hugging Face...");
        try {
            const dir = path.dirname(csvPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            const res = await fetch('https://huggingface.co/datasets/snskrt/Shrimad_Bhagvat_Puran/raw/main/0_Shrimad_Bhagvat_Puran.csv');
            if (!res.ok) {
                throw new Error(`Failed to download dataset CSV: ${res.status}`);
            }
            const csvText = await res.text();
            fs.writeFileSync(csvPath, csvText, 'utf8');
            console.log("Bhagavatam CSV downloaded successfully and saved to:", csvPath);
        } catch (downloadErr) {
            console.error("Error downloading Srimad Bhagavatam dataset CSV:", downloadErr);
            return [];
        }
    }

    try {
        const fileContent = fs.readFileSync(csvPath, 'utf8');
        const rows: BhagavatamRow[] = [];
        let currentLine = '';
        let inQuotes = false;

        for (let i = 0; i < fileContent.length; i++) {
            const char = fileContent[i];
            if (char === '"') {
                inQuotes = !inQuotes;
                currentLine += char;
            } else if (char === '\n' && !inQuotes) {
                const line = currentLine.trim();
                if (line && !line.startsWith('Number,')) {
                    const cols = parseCSVLine(line);
                    const key = cols[0] || '';
                    const parts = key.split('.').map(Number);
                    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                        rows.push({
                            key,
                            canto: parts[0],
                            chapter: parts[1],
                            verse: parts[2],
                            sanskrit: cols[1]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim() || '',
                            transliteration: cols[2]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim() || ''
                        });
                    }
                }
                currentLine = '';
            } else {
                currentLine += char;
            }
        }

        // Catch remaining content on last line
        if (currentLine.trim()) {
            const line = currentLine.trim();
            if (line && !line.startsWith('Number,')) {
                const cols = parseCSVLine(line);
                const key = cols[0] || '';
                const parts = key.split('.').map(Number);
                if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                    rows.push({
                        key,
                        canto: parts[0],
                        chapter: parts[1],
                        verse: parts[2],
                        sanskrit: cols[1]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim() || '',
                        transliteration: cols[2]?.replace(/^"|"$/g, '').replace(/""/g, '"').trim() || ''
                    });
                }
            }
        }

        // Natural sorting: Canto -> Chapter -> Verse
        rows.sort((a, b) => {
            if (a.canto !== b.canto) return a.canto - b.canto;
            if (a.chapter !== b.chapter) return a.chapter - b.chapter;
            return a.verse - b.verse;
        });

        cachedBhagavatamRows = rows;
        return rows;
    } catch (e) {
        console.error("Failed to read/parse Bhagavatam CSV file:", e);
        return [];
    }
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
            const rows = await getBhagavatamRows();
            const targetCanto = 11;
            const targetChapter = chapter + 5; // Uddhava Ch 1 starts at Bhagavatam Canto 11 Chapter 6
            
            const directRow = rows.find(r => r.canto === targetCanto && r.chapter === targetChapter && r.verse === verse);
            if (directRow) {
                loadedSanskrit = `${directRow.sanskrit}\n\n[Transliteration]\n${directRow.transliteration}`;
                loadedTranslation = `Direct English study translation is being loaded from the Purana. (Transliteration: ${directRow.transliteration})`;
                citation = `Uddhava Gita Chapter ${chapter}, Verse ${verse} (Srimad Bhagavatam 11.${targetChapter}.${verse})`;
            } else {
                // If direct verse doesn't exist, check if we exceeded the chapter and need to transition to next chapter
                const nextChapterRow = rows.find(r => r.canto === targetCanto && r.chapter === targetChapter + 1 && r.verse === 1);
                if (nextChapterRow) {
                    loadedSanskrit = `${nextChapterRow.sanskrit}\n\n[Transliteration]\n${nextChapterRow.transliteration}`;
                    loadedTranslation = `Direct English study translation is being loaded from the Purana. (Transliteration: ${nextChapterRow.transliteration})`;
                    actualChapter = chapter + 1;
                    actualVerse = 1;
                    citation = `Uddhava Gita Chapter ${actualChapter}, Verse 1 (Srimad Bhagavatam 11.${targetChapter + 1}.1)`;
                } else {
                    // Generic fallback
                    loadedSanskrit = `|| Uddhava Gita Chapter ${chapter}, Verse ${verse} ||`;
                    loadedTranslation = `Study passage for Uddhava Gita. Please check scripture indexes or navigate back.`;
                    citation = `Uddhava Gita Chapter ${chapter}, Verse ${verse}`;
                }
            }
        } else if (scripture === 'bhagavatam') {
            // ── SHRIMAD BHAGAVATAM ──
            const rows = await getBhagavatamRows();
            const cantoRows = rows.filter(r => r.canto === chapter); // In Bhagavatam, Canto is passed in the "chapter" param
            
            if (cantoRows.length > 0) {
                const safeVerseIndex = Math.min(cantoRows.length, Math.max(1, verse));
                const targetRow = cantoRows[safeVerseIndex - 1];
                
                loadedSanskrit = `${targetRow.sanskrit}\n\n[Transliteration]\n${targetRow.transliteration}`;
                loadedTranslation = `Direct study verse from the Bhagavatam Purana. (Transliteration: ${targetRow.transliteration})`;
                actualChapter = chapter;
                actualVerse = safeVerseIndex;
                citation = `Srimad Bhagavatam Canto ${chapter}, Chapter ${targetRow.chapter}, Verse ${targetRow.verse}`;
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
