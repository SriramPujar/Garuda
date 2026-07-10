import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export const maxDuration = 30;

const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY || '',
});

interface ReflectionData {
    verse: string;
    source: string;
    reflection: string;
}

const FALLBACK_VERSES: Record<string, ReflectionData> = {
    anxious: {
        verse: "For one who has conquered the mind, the mind is the best of friends; but for one who has failed to do so, his very mind will be the greatest enemy.",
        source: "Bhagavad Gita 6.6",
        reflection: "When anxiety clouds your thoughts, remember that your mind is currently acting as an unsteady storm. Breathe deeply, ground yourself in your duty, and let your intellect guide you back to calm waters."
    },
    peace: {
        verse: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.",
        source: "Bhagavad Gita 6.19",
        reflection: "In seeking peace, turn inward. Like a flame sheltered from the wind, allow your thoughts to settle in quiet devotion and self-awareness."
    },
    confused: {
        verse: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.",
        source: "Bhagavad Gita 2.47",
        reflection: "Confusion often arises when we obsess over the outcomes of our decisions. Focus solely on taking the right action in the present moment, surrender the results, and clarity will emerge."
    },
    grateful: {
        verse: "If one offers Me with love and devotion a leaf, a flower, a fruit or water, I will accept it.",
        source: "Bhagavad Gita 9.26",
        reflection: "Gratitude is the simplest form of devotion. Offering thankfulness for the simple gifts of life connects your heart directly to the divine source."
    },
    tired: {
        verse: "Arise, O Arjuna, conqueror of foes! Yield not to weakness, for it does not befit you.",
        source: "Bhagavad Gita 2.3",
        reflection: "It is natural for the body and mind to feel weary. Rest when you must, but do not let spiritual fatigue take root. Reconnect with your inner source of infinite strength."
    }
};

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
    try {
        const { mood } = await req.json();
        const lowerMood = (mood || 'anxious').toLowerCase();
        
        const fallback = FALLBACK_VERSES[lowerMood] || FALLBACK_VERSES['anxious'];

        if (!process.env.GROQ_API_KEY) {
            return Response.json(fallback, { headers: CORS_HEADERS });
        }

        const moodTitles: Record<string, string> = {
            anxious: 'Anxious / Fearful',
            peace: 'Seeking Peace / Quiet',
            confused: 'Confused / Indecisive',
            grateful: 'Grateful / Devotional',
            tired: 'Tired / Weakened'
        };

        const activeMoodTitle = moodTitles[lowerMood] || lowerMood;

        const systemPrompt = `You are Garuda — a wise and compassionate spiritual guide.
The seeker is currently feeling: "${activeMoodTitle}".
Select an inspiring and comforting verse from the Bhagavad Gita, Uddhava Gita, or Srimad Bhagavatam that directly addresses this emotional state.
Generate a JSON object containing the verse translation, its citation, and a short 2-3 sentence compassionate reflection explaining why it matches their mood and how to find peace.

CRITICAL: Return ONLY a raw JSON object. Do not wrap in markdown or backticks.
Schema:
{
  "verse": "The translation of the scriptural verse",
  "source": "The scripture title and chapter/verse numbers (e.g. Bhagavad Gita 2.47)",
  "reflection": "Your comforting, customized reflection directly addressing their mood."
}
`;

        const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            prompt: "Please select a verse and write a reflection based on the instructions.",
            system: systemPrompt,
        });

        // Clean up text if LLM wrapped it in markdown json block
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.substring(7);
        }
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.substring(3);
        }
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        cleaned = cleaned.trim();

        try {
            const parsed = JSON.parse(cleaned);
            if (parsed.verse && parsed.source && parsed.reflection) {
                return Response.json(parsed, { headers: CORS_HEADERS });
            }
        } catch (parseErr) {
            console.error("Failed to parse LLM json output:", cleaned, parseErr);
        }

        // Return fallback on failure
        return Response.json(fallback, { headers: CORS_HEADERS });

    } catch (e: any) {
        console.error("Mood API error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
}
