import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export const maxDuration = 30;

const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY || '',
});

interface ScriptureResponse {
    sanskrit: string;
    translation: string;
    summary: string;
}

const FALLBACK_VERSES: Record<string, ScriptureResponse> = {
    'bg_1_1': {
        sanskrit: "धृतराष्ट्र उवाच |\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः |\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय || 1.1 ||",
        translation: "Dhritarashtra said: O Sanjaya, after assembling in the place of pilgrimage at Kurukshetra, desiring to fight, what did my sons and the sons of Pandu do?",
        summary: "This opening verse sets the scene of the Bhagavad Gita on the holy field of Kurukshetra, reflecting the inner battlefield of the human heart."
    },
    'bg_2_47': {
        sanskrit: "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन |\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि || 2.47 ||",
        translation: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions. Never consider yourself to be the cause of the results of your activities, and never be attached to not doing your duty.",
        summary: "Lord Krishna establishes the foundational philosophy of Karma Yoga: perform your actions with devotion, detached from selfish motives."
    },
    'bg_18_66': {
        sanskrit: "सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज |\nअहं त्वां सर्वपापेभ्यो मोक्षयिष्यामी मा शुचः || 18.66 ||",
        translation: "Abandon all varieties of religion and just surrender unto Me. I shall deliver you from all sinful reactions. Do not fear.",
        summary: "Krishna's final instructions on absolute surrender (Saranagati), offering complete liberation and freedom from anxieties."
    },
    'uddhava_1_1': {
        sanskrit: "Uddhava Gita - Chapter 1, Verse 1",
        translation: "Uddhava requested: O Krishna, please describe how a seeker can cultivate spiritual detachment while residing in this temporary material world.",
        summary: "Uddhava initiates the dialogue by questioning the Lord about spiritual ascension amidst material distractions."
    },
    'bhagavatam_1_1': {
        sanskrit: "जन्माद्यस्य यतोऽन्वयादितरतश्चार्थेष्वभिज्ञः स्वराट् |\nतेने ब्रह्म हृदा य आदिकवये मुह्यन्ति यत्सूरयः || 1.1.1 ||",
        translation: "O my Lord, Sri Krishna, son of Vasudeva, O all-pervading Personality of Godhead, I offer my respectful obeisances unto You. I meditate upon Lord Sri Krishna because He is the Absolute Truth...",
        summary: "The opening invocation of Shrimad Bhagavatam establishes Krishna as the supreme source of creation, maintenance, and ultimate truth."
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
        const { scripture, chapter, verse } = await req.json();
        const scriptKey = `${scripture}_${chapter}_${verse}`;
        
        // Select fallback if we have one pre-defined, or default to bg_2_47
        const defaultFallback = FALLBACK_VERSES[scriptKey] || FALLBACK_VERSES['bg_2_47'];

        if (!process.env.GROQ_API_KEY) {
            return Response.json(defaultFallback, { headers: CORS_HEADERS });
        }

        const scriptureNames: Record<string, string> = {
            bg: 'Bhagavad Gita',
            uddhava: 'Uddhava Gita',
            bhagavatam: 'Shrimad Bhagavatam'
        };

        const activeScriptName = scriptureNames[scripture] || 'Bhagavad Gita';

        const systemPrompt = `You are Garuda — a wise scriptural lookup system.
The user wants to read: "${activeScriptName}" Chapter ${chapter}, Verse ${verse} (or Canto ${chapter}, Chapter ${verse} if Shrimad Bhagavatam).
Please retrieve the correct Sanskrit text, direct English translation, and a brief 1-2 sentence core message summary for this specific verse.

CRITICAL: Return ONLY a raw JSON block. Do not wrap in markdown or backticks.
Schema:
{
  "sanskrit": "Sanskrit text (Devanagari if possible, with English transliteration below)",
  "translation": "Direct English translation of the verse",
  "summary": "Core spiritual takeaway of this verse"
}
`;

        const { text } = await generateText({
            model: groq('llama-3.3-70b-versatile'),
            prompt: `Please retrieve ${activeScriptName} Chapter ${chapter}, Verse ${verse} matching instructions.`,
            system: systemPrompt,
        });

        // Clean up markdown wrapping
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
            if (parsed.sanskrit && parsed.translation && parsed.summary) {
                return Response.json(parsed, { headers: CORS_HEADERS });
            }
        } catch (parseErr) {
            console.error("Failed to parse JSON scripture output:", cleaned, parseErr);
        }

        return Response.json(defaultFallback, { headers: CORS_HEADERS });

    } catch (e: any) {
        console.error("Scripture API error:", e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
}
