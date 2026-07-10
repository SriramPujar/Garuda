import { useState } from 'react';
import styles from './MoodGuidance.module.css';

const MOODS = [
    { id: 'anxious', label: 'Anxious', icon: '😰' },
    { id: 'peace',   label: 'Seeking Peace', icon: '🪷' },
    { id: 'confused',label: 'Confused', icon: '🧭' },
    { id: 'grateful',label: 'Grateful', icon: '🙏' },
    { id: 'tired',   label: 'Tired', icon: '🥱' }
];

interface ReflectionData {
    verse: string;
    source: string;
    reflection: string;
}

interface MoodGuidanceProps {
    onSelectVerse: (verseText: string, source: string) => void;
}

export default function MoodGuidance({ onSelectVerse }: MoodGuidanceProps) {
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [data, setData] = useState<ReflectionData | null>(null);

    const handleMoodSelect = async (moodId: string) => {
        setSelectedMood(moodId);
        setIsLoading(true);
        setData(null);

        try {
            const res = await fetch('/api/mood', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mood: moodId })
            });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                throw new Error("Failed to fetch");
            }
        } catch (e) {
            console.error("Failed to load mood guidance, falling back...", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedMood(null);
        setData(null);
    };

    return (
        <div className={styles.container}>
            {!selectedMood ? (
                <div className={styles.moodSection}>
                    <h3 className={styles.headerTitle}>How are you feeling today?</h3>
                    <div className={styles.grid}>
                        {MOODS.map(m => (
                            <button
                                key={m.id}
                                className={styles.moodCard}
                                onClick={() => handleMoodSelect(m.id)}
                            >
                                <span className={styles.moodIcon}>{m.icon}</span>
                                <span className={styles.moodLabel}>{m.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                <div className={styles.cardSection}>
                    {isLoading ? (
                        <div className={styles.loadingCard}>
                            <div className={styles.spinner}></div>
                            <p className={styles.loadingText}>Seeking scriptural guidance for you...</p>
                        </div>
                    ) : data ? (
                        <div className={styles.reflectionCard}>
                            <div className={styles.verseHeader}>
                                <span className={styles.quoteMark}>“</span>
                                <p className={styles.verseText}>{data.verse}</p>
                                <span className={styles.verseSource}>— {data.source}</span>
                            </div>
                            <div className={styles.reflectionBody}>
                                <h4 className={styles.reflectionTitle}>🕉 Garuda Reflection</h4>
                                <p className={styles.reflectionText}>{data.reflection}</p>
                            </div>
                            <div className={styles.actions}>
                                <button className={styles.resetBtn} onClick={handleReset}>
                                    Choose Another Mood
                                </button>
                                <button
                                    className={styles.discussBtn}
                                    onClick={() => onSelectVerse(data.verse, data.source)}
                                >
                                    Discuss with Garuda
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.errorCard}>
                            <p>Could not connect to scriptural wisdom. Please try again.</p>
                            <button className={styles.resetBtn} onClick={handleReset}>Retry</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
