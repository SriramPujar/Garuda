'use client';

import { useState, useEffect } from 'react';

const VERSES = [
    { text: "You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.", source: "Bhagavad Gita 2.47" },
    { text: "The soul can never be cut into pieces by any weapon, nor can it be burned by fire, nor moistened by water, nor withered by the wind.", source: "Bhagavad Gita 2.23" },
    { text: "For one who has conquered the mind, the mind is the best of friends; but for one who has failed to do so, his very mind will be the greatest enemy.", source: "Bhagavad Gita 6.6" },
    { text: "There is no loss or diminution in this endeavor, and even a little advancement on this path can protect one from the most dangerous type of fear.", source: "Bhagavad Gita 2.40" },
    { text: "When meditation is mastered, the mind is unwavering like the flame of a lamp in a windless place.", source: "Bhagavad Gita 6.19" }
];

export default function DailyQuote() {
    const [quote, setQuote] = useState(VERSES[0]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Simple "Daily" hash based on date
        const today = new Date().toDateString();
        let index = 0;

        // Create a simple hash from the date string
        for (let i = 0; i < today.length; i++) {
            index += today.charCodeAt(i);
        }

        const dailyIndex = index % VERSES.length;
        setQuote(VERSES[dailyIndex]);
    }, []);

    if (!mounted) return null;

    return (
        <div style={{
            textAlign: 'center',
            padding: '1.5rem',
            margin: '1.5rem auto',
            maxWidth: '600px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeUpReveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
            <p style={{
                fontFamily: 'var(--font-serif)',
                color: 'var(--color-text-primary)',
                fontSize: '1.15rem',
                fontStyle: 'italic',
                lineHeight: '1.6',
                marginBottom: '0.75rem',
                letterSpacing: '0.02em',
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
            }}>
                &ldquo;{quote.text}&rdquo;
            </p>
            <span style={{
                fontSize: '0.85rem',
                color: 'var(--color-saffron-500)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.9
            }}>
                — {quote.source}
            </span>
        </div>
    );
}
