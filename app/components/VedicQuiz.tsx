import { useState, useEffect } from 'react';
import styles from './VedicQuiz.module.css';

const DAILY_EXERCISES = [
    {
        dayIndex: 0,
        type: 'quiz' as const,
        question: "What does 'Karma Yoga' mean in the Bhagavad Gita?",
        options: [
            "Performing rituals for health and wealth",
            "Path of action without attachment to results",
            "Complete renunciation of all physical work",
            "Meditation in isolation in the forest"
        ],
        correctAnswer: 1,
        explanation: "In Bhagavad Gita 2.47, Lord Krishna says: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' This is the essence of Karma Yoga.",
        prompt: "Reflect on a recent task you performed at work or home. How can you perform this duty with zero attachment to the recognition or outcome?"
    },
    {
        dayIndex: 1,
        type: 'quiz' as const,
        question: "Identify the verse where Arjuna is told to arise and fight, casting off faint-heartedness.",
        options: [
            "Bhagavad Gita 2.3 (Yield not to unmanliness...)",
            "Bhagavad Gita 4.7 (Whenever righteousness declines...)",
            "Bhagavad Gita 9.26 (If one offers with love...)",
            "Bhagavad Gita 18.66 (Abandon all varieties of religion...)"
        ],
        correctAnswer: 0,
        explanation: "In Bhagavad Gita 2.3, Krishna tells Arjuna: 'O son of Pritha, yield not to unmanliness; it does not befit you. Cast off this petty weakness of heart and arise, O chastiser of the enemy!'",
        prompt: "Think of an area in your life where you feel hesitant, fearful, or ready to retreat. What does 'casting off petty weakness and arising' look like in this situation?"
    },
    {
        dayIndex: 2,
        type: 'quiz' as const,
        question: "What is the meaning of 'Dharma' in Vedic scriptures?",
        options: [
            "Blind faith in a specific dogma",
            "Performing only physical exercises",
            "Righteous duty, moral order, and cosmic alignment",
            "Giving up all wealth and money"
        ],
        correctAnswer: 2,
        explanation: "Dharma is derived from the Sanskrit root 'dhri' (to sustain). It refers to the righteous duties that uphold order, morality, and cosmic harmony.",
        prompt: "If your life's actions are currently divided into 'desires' versus 'duties', which side has more weight? What is one action you can take today solely because it is your Dharma?"
    },
    {
        dayIndex: 3,
        type: 'quiz' as const,
        question: "In the Bhagavad Gita, what is described as the 'best of friends' and also the 'greatest enemy'?",
        options: [
            "A person's external wealth",
            "A person's own mind",
            "The physical body",
            "One's relatives and family"
        ],
        correctAnswer: 1,
        explanation: "In Bhagavad Gita 6.6, Krishna states: 'For one who has conquered the mind, the mind is the best of friends; but for one who has failed to do so, his very mind will be the greatest enemy.'",
        prompt: "Observe your mind's chatter today. Is it behaving as your friend (encouraging, clear, calm) or your enemy (distracting, criticizing, worrying)? What is a scriptural truth you can remind yourself of to calm it?"
    },
    {
        dayIndex: 4,
        type: 'quiz' as const,
        question: "What is the Sanskrit term for 'unflinching devotion' or 'loving service' to the Supreme?",
        options: [
            "Jnana",
            "Karma",
            "Bhakti",
            "Tapas"
        ],
        correctAnswer: 2,
        explanation: "Bhakti comes from the root 'bhaj', meaning to serve or belong to. It is the path of loving devotion, highlighted by Krishna as the most direct path to union.",
        prompt: "How can you inject 'Bhakti' (love, devotion, gratitude) into a routine chore today, converting a mundane task into a loving offering?"
    }
];

interface VedicQuizProps {
    onSubmitReflection: (promptText: string, reflectionText: string) => void;
}

export default function VedicQuiz({ onSubmitReflection }: VedicQuizProps) {
    const [exercise, setExercise] = useState(DAILY_EXERCISES[0]);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [scoreAwarded, setScoreAwarded] = useState(false);
    const [reflection, setReflection] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const today = new Date().getDate();
        const dailyIndex = today % DAILY_EXERCISES.length;
        setExercise(DAILY_EXERCISES[dailyIndex]);

        // Load submission states from localStorage if they exist
        const quizKey = `garuda_quiz_completed_${today}`;
        const storedOption = localStorage.getItem(quizKey);
        if (storedOption !== null) {
            setSelectedOption(parseInt(storedOption));
            setIsSubmitted(true);
        }
        
        const reflKey = `garuda_reflection_submitted_${today}`;
        const storedRefl = localStorage.getItem(reflKey);
        if (storedRefl) {
            setReflection(storedRefl);
        }
    }, []);

    if (!mounted) return null;

    const handleOptionSelect = (index: number) => {
        if (isSubmitted) return;
        setSelectedOption(index);
    };

    const handleQuizSubmit = () => {
        if (selectedOption === null || isSubmitted) return;
        setIsSubmitted(true);

        const today = new Date().getDate();
        localStorage.setItem(`garuda_quiz_completed_${today}`, selectedOption.toString());

        if (selectedOption === exercise.correctAnswer) {
            setScoreAwarded(true);
            // Award score hook could go here (e.g. state/profile update)
        }
    };

    const handleReflectionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!reflection.trim()) return;

        const today = new Date().getDate();
        localStorage.setItem(`garuda_reflection_submitted_${today}`, reflection);

        onSubmitReflection(exercise.prompt, reflection);
    };

    const isCorrect = selectedOption === exercise.correctAnswer;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>🕉️ Daily Vedic Contemplation</h2>
                <p className={styles.subtitle}>Align your intellect and heart with scriptural wisdom every day.</p>
            </div>

            <div className={styles.cardLayout}>
                {/* 1. Daily Quiz Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardBadge}>DAILY QUIZ</span>
                    </div>
                    <h3 className={styles.questionText}>{exercise.question}</h3>

                    <div className={styles.optionsList}>
                        {exercise.options.map((opt, index) => {
                            let optionClass = styles.optionBtn;
                            if (selectedOption === index) {
                                optionClass += ` ${styles.optionBtnSelected}`;
                            }
                            if (isSubmitted) {
                                optionClass += ` ${styles.optionDisabled}`;
                                if (index === exercise.correctAnswer) {
                                    optionClass += ` ${styles.optionCorrect}`;
                                } else if (selectedOption === index) {
                                    optionClass += ` ${styles.optionIncorrect}`;
                                }
                            }

                            return (
                                <button
                                    key={index}
                                    type="button"
                                    className={optionClass}
                                    onClick={() => handleOptionSelect(index)}
                                    disabled={isSubmitted}
                                >
                                    <span className={styles.optionLetter}>
                                        {String.fromCharCode(65 + index)}
                                    </span>
                                    <span className={styles.optionLabel}>{opt}</span>
                                </button>
                            );
                        })}
                    </div>

                    {!isSubmitted ? (
                        <button
                            type="button"
                            className={styles.submitQuizBtn}
                            onClick={handleQuizSubmit}
                            disabled={selectedOption === null}
                        >
                            Verify Answer
                        </button>
                    ) : (
                        <div className={styles.explanationSection}>
                            <div className={isCorrect ? styles.alertSuccess : styles.alertError}>
                                <span className={styles.alertIcon}>{isCorrect ? '✨' : '📝'}</span>
                                <span className={styles.alertText}>
                                    {isCorrect 
                                        ? "Correct! You have earned +10 Dharma Points. Hari Bol!" 
                                        : "Incorrect, but every question is a path to knowledge."}
                                </span>
                            </div>
                            <h4 className={styles.explanationTitle}>Scriptural Context</h4>
                            <p className={styles.explanationText}>{exercise.explanation}</p>
                        </div>
                    )}
                </div>

                {/* 2. Daily Contemplation Prompt Card */}
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <span className={styles.cardBadge} style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--color-saffron-500)' }}>REFLECT & TRANSCEND</span>
                    </div>
                    <h3 className={styles.questionText} style={{ fontStyle: 'italic', color: '#cbd5e1', lineHeight: '1.6' }}>
                        &ldquo;{exercise.prompt}&rdquo;
                    </h3>

                    <form onSubmit={handleReflectionSubmit} className={styles.reflectionForm}>
                        <textarea
                            className={styles.textarea}
                            placeholder="Contemplate and write your thoughts here. You can submit this directly to Garuda to get scriptural feedback and guide your journey..."
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            rows={5}
                        />
                        <button
                            type="submit"
                            className={styles.submitReflBtn}
                            disabled={!reflection.trim()}
                        >
                            🕉️ Discuss Reflection with Garuda
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
