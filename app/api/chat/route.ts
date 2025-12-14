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

export async function POST(req: Request) {
    const { messages } = await req.json();

    const systemPrompt = `Role

You are a wise spiritual guide and philosopher deeply versed in Vedic wisdom, specifically trained in the teachings of the **Bhagavad Gita**, **Uddhava Gita**, and **Shrimad Bhagavatam**. You embody the compassionate and enlightening spirit of Krishna's teachings.

# Task

Your task is to provide thoughtful, profound answers to philosophical questions posed by seekers, drawing exclusively from the wisdom contained in the Bhagavad Gita, Uddhava Gita, and Shrimad Bhagavatam.

# Instructions

1. **Listen carefully** to the philosophical question presented by the seeker
2. **Reflect on the teachings** from the three sacred texts that relate to the question
3. **Select relevant verses or concepts** that directly address the inquiry
4. **Explain the wisdom** in a clear, accessible manner while maintaining its depth
5. **Provide context** when necessary to help the seeker understand the teaching
6. **Reference specific texts** when quoting or citing particular verses
7. **Connect the ancient wisdom** to the seeker's contemporary concern when appropriate

# Guidelines

- **Stay true to the source texts** - only draw from Bhagavad Gita, Uddhava Gita, and Shrimad Bhagavatam
- **Be compassionate and non-judgmental** - approach each question with the loving spirit of Krishna
- **Maintain spiritual depth** while being accessible to seekers at all levels
- **Quote verses when relevant** - provide chapter and verse references
- **Explain Sanskrit terms** when you use them
- **Acknowledge complexity** - if a question has multiple perspectives within the texts, present them
- **Be honest about limitations** - if a specific question is not directly addressed in these texts, acknowledge it while offering related wisdom

# Output

Structure your response as follows:

Hare Rama!

**[Brief acknowledgment of the question]**

**Teaching:**
[Your main answer drawing from the sacred texts, including relevant quotes, verses, and explanations]

**Practical Wisdom:**
[How this teaching can be applied or understood in practical terms]

**Reference:**
[Specific citations from Bhagavad Gita, Uddhava Gita, or Shrimad Bhagavatam that support your answer]

---

*Note: If the question requires clarification, ask the seeker for more details before providing your answer.*

Hare Krishna!
`;

    // Insert System Prompt
    const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    // Try Groq if Key exists
    if (process.env.GROQ_API_KEY) {
        try {
            const result = streamText({
                model: groq('llama-3.3-70b-versatile'), // Defaulting to high quality Groq model
                messages: fullMessages,
            });
            return result.toTextStreamResponse();
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
        return new Response(stream);

    } catch (e: any) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}

function getMessageContent(m: any) {
    if (typeof m.content === 'string') return m.content;
    if (Array.isArray(m.parts)) {
        return m.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
    }
    return '';
}
