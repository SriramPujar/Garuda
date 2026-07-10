import { useState, useEffect } from 'react';
import styles from './ScriptureStudy.module.css';

const SCRIPTURE_METADATA = {
    bg: {
        name: "Bhagavad Gita",
        totalChapters: 18,
        icon: "📖",
        description: "The song of the Supreme, containing Krishna's counsel to Arjuna on the battlefield of Kurukshetra.",
        unitsLabel: "Chapter"
    },
    uddhava: {
        name: "Uddhava Gita",
        totalChapters: 24,
        icon: "🌺",
        description: "Lord Krishna's final instructions on yoga, devotion, and absolute detachment spoken to Uddhava.",
        unitsLabel: "Chapter"
    },
    bhagavatam: {
        name: "Shrimad Bhagavatam",
        totalChapters: 12,
        icon: "🪷",
        description: "The essence of all Vedic literature, covering the pastimes, philosophy, and incarnations of the Supreme.",
        unitsLabel: "Canto"
    }
};

interface ScriptureStudyProps {
    scriptureId: 'bg' | 'uddhava' | 'bhagavatam';
    onAskGaruda: (verseText: string, citation: string) => void;
}

interface VerseData {
    sanskrit: string;
    translation: string;
    summary: string;
    citation: string;
}

export default function ScriptureStudy({ scriptureId, onAskGaruda }: ScriptureStudyProps) {
    const meta = SCRIPTURE_METADATA[scriptureId];

    const [studyState, setStudyState] = useState<'setup' | 'reading'>('setup');
    const [chapter, setChapter] = useState(1); // Canto for Bhagavatam, Chapter for others
    const [subChapter, setSubChapter] = useState(1); // Chapter for Bhagavatam
    const [verse, setVerse] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [verseData, setVerseData] = useState<VerseData | null>(null);

    // Temp selection values for setup state
    const [tempChapter, setTempChapter] = useState(1);
    const [tempSubChapter, setTempSubChapter] = useState(1);
    const [tempVerse, setTempVerse] = useState(1);

    useEffect(() => {
        // Reset when scriptureId changes
        setStudyState('setup');
        setChapter(1);
        setSubChapter(1);
        setVerse(1);
        setTempChapter(1);
        setTempSubChapter(1);
        setTempVerse(1);
        setVerseData(null);
    }, [scriptureId]);

    const loadVerse = async (ch: number, subCh: number | null, vr: number) => {
        setIsLoading(true);
        setVerseData(null);
        try {
            const body: any = {
                scripture: scriptureId,
                chapter: ch,
                verse: vr
            };
            if (scriptureId === 'bhagavatam' && subCh !== null) {
                body.canto = ch;
                body.subChapter = subCh;
                body.chapter = subCh;
            }

            const res = await fetch('/api/scripture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                const data = await res.json();
                setVerseData(data);
                if (data.actualChapter && data.actualVerse) {
                    if (scriptureId === 'bhagavatam') {
                        const newCanto = data.actualCanto || ch;
                        setChapter(newCanto);
                        setSubChapter(data.actualChapter);
                        setVerse(data.actualVerse);
                        saveProgress(newCanto, data.actualChapter, data.actualVerse);
                    } else {
                        setChapter(data.actualChapter);
                        setVerse(data.actualVerse);
                        saveProgress(data.actualChapter, 1, data.actualVerse);
                    }
                }
            } else {
                throw new Error("Failed to fetch verse");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartFromBeginning = () => {
        const ch = 1;
        const subCh = 1;
        const vr = 1;
        setChapter(ch);
        setSubChapter(subCh);
        setVerse(vr);
        setStudyState('reading');
        saveProgress(ch, subCh, vr);
        loadVerse(ch, scriptureId === 'bhagavatam' ? subCh : null, vr);
    };

    const handleContinuePrevious = () => {
        const stored = localStorage.getItem(`garuda_study_progress_${scriptureId}`);
        if (stored) {
            const { ch, subCh, vr } = JSON.parse(stored);
            setChapter(ch);
            setSubChapter(subCh || 1);
            setVerse(vr);
            setStudyState('reading');
            loadVerse(ch, scriptureId === 'bhagavatam' ? (subCh || 1) : null, vr);
        } else {
            handleStartFromBeginning();
        }
    };

    const handleCustomStart = () => {
        setChapter(tempChapter);
        setSubChapter(tempSubChapter);
        setVerse(tempVerse);
        setStudyState('reading');
        saveProgress(tempChapter, tempSubChapter, tempVerse);
        loadVerse(tempChapter, scriptureId === 'bhagavatam' ? tempSubChapter : null, tempVerse);
    };

    const saveProgress = (ch: number, subCh: number, vr: number) => {
        localStorage.setItem(`garuda_study_progress_${scriptureId}`, JSON.stringify({ ch, subCh, vr }));
    };

    const handlePrevVerse = () => {
        if (verse > 1) {
            const newVr = verse - 1;
            setVerse(newVr);
            saveProgress(chapter, subChapter, newVr);
            loadVerse(chapter, scriptureId === 'bhagavatam' ? subChapter : null, newVr);
        } else if (scriptureId === 'bhagavatam') {
            if (subChapter > 1) {
                const newSubCh = subChapter - 1;
                setSubChapter(newSubCh);
                setVerse(1);
                saveProgress(chapter, newSubCh, 1);
                loadVerse(chapter, newSubCh, 1);
            } else if (chapter > 1) {
                const newCanto = chapter - 1;
                setChapter(newCanto);
                setSubChapter(1);
                setVerse(1);
                saveProgress(newCanto, 1, 1);
                loadVerse(newCanto, 1, 1);
            }
        } else if (chapter > 1) {
            const newCh = chapter - 1;
            setChapter(newCh);
            setVerse(1);
            saveProgress(newCh, 1, 1);
            loadVerse(newCh, null, 1);
        }
    };

    const handleNextVerse = () => {
        const newVr = verse + 1;
        setVerse(newVr);
        saveProgress(chapter, subChapter, newVr);
        loadVerse(chapter, scriptureId === 'bhagavatam' ? subChapter : null, newVr);
    };

    const handleCompleteChapter = () => {
        if (scriptureId === 'bhagavatam') {
            const newSubCh = subChapter + 1;
            setSubChapter(newSubCh);
            setVerse(1);
            saveProgress(chapter, newSubCh, 1);
            loadVerse(chapter, newSubCh, 1);
        } else if (chapter < meta.totalChapters) {
            const newCh = chapter + 1;
            setChapter(newCh);
            setVerse(1);
            saveProgress(newCh, 1, 1);
            loadVerse(newCh, null, 1);
        } else {
            alert(`Congratulations! You have completed all chapters of the ${meta.name}! 🕉️`);
        }
    };

    const progressPercentage = Math.round((chapter / meta.totalChapters) * 100);
    const hasSavedProgress = typeof window !== 'undefined' && localStorage.getItem(`garuda_study_progress_${scriptureId}`) !== null;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>{meta.icon}</span>
                <h2 className={styles.title}>Study {meta.name}</h2>
                <p className={styles.subtitle}>{meta.description}</p>
            </div>

            {studyState === 'setup' ? (
                <div className={styles.setupSection}>
                    <div className={styles.optionsGrid}>
                        <button className={styles.setupCard} onClick={handleStartFromBeginning}>
                            <span className={styles.setupIcon}>🌱</span>
                            <span className={styles.setupTitle}>Start from Beginning</span>
                            <span className={styles.setupDesc}>
                                {scriptureId === 'bhagavatam' 
                                    ? "Begin at Canto 1, Chapter 1, Verse 1." 
                                    : `Begin at ${meta.unitsLabel} 1, Verse 1.`}
                            </span>
                        </button>

                        <button 
                            className={`${styles.setupCard} ${!hasSavedProgress ? styles.cardDisabled : ''}`} 
                            onClick={handleContinuePrevious}
                            disabled={!hasSavedProgress}
                        >
                            <span className={styles.setupIcon}>🔄</span>
                            <span className={styles.setupTitle}>Continue Study</span>
                            <span className={styles.setupDesc}>Resume from where you left off.</span>
                        </button>
                    </div>

                    <div className={styles.customStartCard}>
                        <h4 className={styles.customTitle}>Jump to specific passage</h4>
                        <div className={styles.customRow}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>{meta.unitsLabel}:</label>
                                <select 
                                    className={styles.select}
                                    value={tempChapter}
                                    onChange={(e) => setTempChapter(parseInt(e.target.value))}
                                >
                                    {Array.from({ length: meta.totalChapters }, (_, i) => i + 1).map(n => (
                                        <option key={n} value={n}>{meta.unitsLabel} {n}</option>
                                    ))}
                                </select>
                            </div>

                            {scriptureId === 'bhagavatam' && (
                                <div className={styles.inputGroup}>
                                    <label className={styles.label}>Chapter:</label>
                                    <input 
                                        type="number" 
                                        className={styles.input} 
                                        min={1} 
                                        max={100}
                                        value={tempSubChapter}
                                        onChange={(e) => setTempSubChapter(Math.max(1, parseInt(e.target.value) || 1))}
                                    />
                                </div>
                            )}

                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Verse:</label>
                                <input 
                                    type="number" 
                                    className={styles.input} 
                                    min={1} 
                                    max={120}
                                    value={tempVerse}
                                    onChange={(e) => setTempVerse(Math.max(1, parseInt(e.target.value) || 1))}
                                />
                            </div>

                            <button className={styles.goBtn} onClick={handleCustomStart}>
                                Begin Study
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.readingSection}>
                    {/* Course Progress */}
                    <div className={styles.progressCard}>
                        <div className={styles.progressLabelRow}>
                            <span className={styles.progressText}>
                                {scriptureId === 'bhagavatam'
                                    ? `Progress: Canto ${chapter}, Chapter ${subChapter} of Srimad Bhagavatam`
                                    : `Progress: Chapter ${chapter} of ${meta.totalChapters} completed`}
                            </span>
                            {scriptureId !== 'bhagavatam' && (
                                <span className={styles.progressText}>{progressPercentage}%</span>
                            )}
                        </div>
                        {scriptureId !== 'bhagavatam' && (
                            <div className={styles.progressBarBg}>
                                <div className={styles.progressBarFill} style={{ width: `${progressPercentage}%` }}></div>
                            </div>
                        )}
                    </div>

                    {/* Active Reading Card */}
                    <div className={styles.studyCard}>
                        <div className={styles.studyCardHeader}>
                            <span className={styles.breadcrumb}>
                                {verseData?.citation || (scriptureId === 'bhagavatam' 
                                    ? `${meta.name} > Canto ${chapter}, Chapter ${subChapter}, Verse ${verse}`
                                    : `${meta.name} > Chapter ${chapter}, Verse ${verse}`)}
                            </span>
                            <button className={styles.changePosBtn} onClick={() => setStudyState('setup')}>
                                Adjust Start Point
                            </button>
                        </div>

                        {isLoading ? (
                            <div className={styles.loadingArea}>
                                <div className={styles.spinner}></div>
                                <p className={styles.loadingText}>Retrieving sacred verses...</p>
                            </div>
                        ) : verseData ? (
                            <div className={styles.verseContent}>
                                <div className={styles.sanskritPanel}>
                                    <p className={styles.sanskritText}>{verseData.sanskrit}</p>
                                </div>
                                
                                <div className={styles.translationPanel}>
                                    <h4 className={styles.panelTitle}>Meaning & Translation</h4>
                                    <p className={styles.translationText}>{verseData.translation}</p>
                                </div>

                                <div className={styles.summaryPanel}>
                                    <h4 className={styles.panelTitle}>Garuda Summary</h4>
                                    <p className={styles.summaryText}>{verseData.summary}</p>
                                </div>
                            </div>
                        ) : (
                            <div className={styles.errorArea}>
                                <p>Could not retrieve this verse. Check your network or adjust your start coordinates.</p>
                            </div>
                        )}

                        {/* Navigation Row */}
                        <div className={styles.navigationRow}>
                            <button 
                                className={styles.navBtn} 
                                onClick={handlePrevVerse}
                                disabled={chapter === 1 && subChapter === 1 && verse === 1}
                            >
                                ← Prev Verse
                            </button>

                            <button 
                                className={styles.discussBtn} 
                                onClick={() => onAskGaruda(
                                    verseData?.translation || '', 
                                    scriptureId === 'bhagavatam' 
                                        ? `${meta.name} Canto ${chapter}, Chapter ${subChapter}, Verse ${verse}`
                                        : `${meta.name} ${meta.unitsLabel} ${chapter}, Verse ${verse}`
                                )}
                                disabled={!verseData}
                            >
                                🕉️ Ask Garuda About This Verse
                            </button>

                            <button 
                                className={styles.navBtn} 
                                onClick={handleNextVerse}
                                disabled={!verseData}
                            >
                                Next Verse →
                            </button>
                        </div>

                        <div className={styles.completeChapterRow}>
                            <button className={styles.completeChapterBtn} onClick={handleCompleteChapter}>
                                ✓ Complete Chapter & Go Next
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
