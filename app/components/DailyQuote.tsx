'use client';

import { useState, useEffect } from 'react';
import styles from '../page.module.css';

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
        <div className={styles.quoteCard}>
            <p className={styles.quoteText}>
                &ldquo;{quote.text}&rdquo;
            </p>
            <span className={styles.quoteSource}>
                — {quote.source}
            </span>
        </div>
    );
}
