'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import styles from './page.module.css';
import LoginModal from './components/LoginModal';
import ConfirmModal from './components/ConfirmModal';
import MoodGuidance from './components/MoodGuidance';
import VedicQuiz from './components/VedicQuiz';
import ScriptureStudy from './components/ScriptureStudy';
import LibraryNotes from './components/LibraryNotes';
import { Capacitor } from '@capacitor/core';

// Map raw PDF filenames → beautiful display names
function prettifySource(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('bhagavad') || lower.includes('gita-as-it-is') || lower.includes('gita_as_it_is') || lower.includes('bhagavad_gita')) return 'Bhagavad Gita';
    if (lower.includes('uddhava')) return 'Uddhava Gita';
    if (lower.includes('bhagavata') || lower.includes('bhagavatam') || lower.includes('bhagavata-mahapurana')) return 'Śrīmad Bhāgavatam';
    return filename.replace(/[-_]/g, ' ').replace(/\.pdf$/i, '');
}


interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface Session {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
}

// Book filter definitions
const BOOKS = [
    { id: 'all',        label: 'All Scriptures',  icon: '🕉️' },
    { id: 'bg',         label: 'Bhagavad Gita',    icon: '📖' },
    { id: 'uddhava',    label: 'Uddhava Gita',     icon: '🌺' },
    { id: 'bhagavatam', label: 'Bhāgavatam',       icon: '🪷' },
];

// Tone filter definitions
const TONES = [
    { id: 'traditional', label: 'Traditional / Sanskrit-heavy', icon: '📿' },
    { id: 'beginner',    label: 'Simple / Beginner',  icon: '🌱' },
    { id: 'modern',      label: 'Modern / Casual',      icon: '✨' },
];

export default function Chat() {
    const { data: session, status } = useSession();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isNative, setIsNative] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        message: '',
        onConfirm: () => {}
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'dharma' | 'forest'>('dharma');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [tone, setTone] = useState<'beginner' | 'traditional' | 'modern'>('traditional');
    const [activeTab, setActiveTab] = useState<'chat' | 'quiz' | 'study' | 'library'>('chat');
    const [selectedStudyScripture, setSelectedStudyScripture] = useState<'bg' | 'uddhava' | 'bhagavatam'>('bg');
    const [selectedNoteIdForLibrary, setSelectedNoteIdForLibrary] = useState<string | null>(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isToneOpen, setIsToneOpen] = useState(false);

    // Generative AI content reporting states (Policy 11.16)
    const [reportingMessage, setReportingMessage] = useState<{ id: string; content: string } | null>(null);
    const [reportReason, setReportReason] = useState('inappropriate');
    const [reportDetails, setReportDetails] = useState('');

    const handleReportClick = (id: string, content: string) => {
        setReportingMessage({ id, content });
    };

    const submitReport = () => {
        console.log('Report submitted:', {
            messageId: reportingMessage?.id,
            content: reportingMessage?.content,
            reason: reportReason,
            details: reportDetails
        });
        alert('Thank you! Your report has been submitted. We will review this response.');
        setReportingMessage(null);
        setReportDetails('');
        setReportReason('inappropriate');
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        const handleOutsideClick = () => {
            setIsSearchOpen(false);
            setIsToneOpen(false);
        };
        window.addEventListener('click', handleOutsideClick);
        return () => window.removeEventListener('click', handleOutsideClick);
    }, []);

    // Initialize: Theme & PWA setup (runs once)
    useEffect(() => {
        const savedTheme = localStorage.getItem('garuda-theme') as 'dharma' | 'forest';
        if (savedTheme) setTheme(savedTheme);

        // Detect native platform (Capacitor Android/iOS)
        setIsNative(Capacitor.isNativePlatform());

        // Unregister lingering service workers
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        }

        // Clear chat when resuming app (Capacitor)
        if (typeof window !== 'undefined') {
            import('@capacitor/app').then(({ App }) => {
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) {
                        setCurrentSessionId(null);
                        setMessages([]);
                    }
                });
            }).catch(() => {});
        }
    }, []);

    // Load sessions from DB whenever auth status becomes 'authenticated'
    useEffect(() => {
        if (status === 'authenticated') {
            setIsInitialized(false);
            fetch('/api/sessions')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setSessions(data);
                    }
                    setIsInitialized(true);
                })
                .catch(err => {
                    console.error("Failed to load sessions", err);
                    setIsInitialized(true);
                });
        } else if (status === 'unauthenticated') {
            setSessions([]);
            setCurrentSessionId(null);
            setMessages([]);
            setIsInitialized(true);
        }
    }, [status]);

    // Effect: Sync Theme changes
    useEffect(() => {
        localStorage.setItem('garuda-theme', theme);
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    // Effect: Capture PWA install prompt
    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Sessions are saved directly to DB now

    // Effect: Scroll on message update
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleInstallClick = async () => {
        if (isNative) {
            // Already running as a native app on Android/iOS
            alert('Garuda is already installed as an app on your device! ॐ');
            return;
        }
        if (!deferredPrompt) {
            alert('To install Garuda:\n\nOn Android Chrome: tap the ⋮ menu → "Add to Home screen"\nOn iOS Safari: tap Share (□↑) → "Add to Home Screen"');
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
        }
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'dharma' ? 'forest' : 'dharma');
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setIsSidebarOpen(false); // Close sidebar on mobile on selection
    };

    const selectSession = (sessionId: string) => {
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            setCurrentSessionId(session.id);
            setMessages(session.messages);
            setIsSidebarOpen(false);
        }
    };

    const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation(); // Don't trigger selectSession
        
        const session = sessions.find(s => s.id === sessionId);
        const title = session ? `"${session.title}"` : "this chat";
        
        setConfirmModal({
            isOpen: true,
            message: `Are you sure you want to permanently delete ${title}? This action cannot be undone.`,
            onConfirm: async () => {
                // Optimistic UI
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                if (currentSessionId === sessionId) {
                    setCurrentSessionId(null);
                    setMessages([]);
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));

                // Delete from server
                try {
                    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
                } catch (e) {
                    console.error('Failed to delete', e);
                }
            }
        });
    };

    const deleteAllSessions = async () => {
        setConfirmModal({
            isOpen: true,
            message: "Are you sure you want to permanently delete ALL historical chats? This action is irreversible.",
            onConfirm: async () => {
                const sessionsToDelete = [...sessions];
                setSessions([]);
                setCurrentSessionId(null);
                setMessages([]);
                setIsSidebarOpen(false);
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                
                // Delete all individually
                for (const s of sessionsToDelete) {
                    await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
                }
            }
        });
    };

    const updateCurrentSession = (updatedMessages: Message[], sessionId: string) => {
        setSessions(prev => {
            let newSessions = [...prev];

            const index = newSessions.findIndex(s => s.id === sessionId);
            if (index !== -1) {
                // Update existing
                newSessions[index] = { ...newSessions[index], messages: updatedMessages };
                // Move to top
                const moved = newSessions.splice(index, 1)[0];
                newSessions.unshift(moved);
            } else {
                // Create new session
                // Generate title from first message
                const firstUserMsg = updatedMessages.find(m => m.role === 'user');
                const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 'New Chat';

                const newSession: Session = {
                    id: sessionId,
                    title: title,
                    timestamp: Date.now(),
                    messages: updatedMessages
                };
                newSessions.unshift(newSession);
            }
            return newSessions;
        });
    };

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''));
            const voices = window.speechSynthesis.getVoices();
            const indianVoice = voices.find(v => v.lang.includes('IN') || v.name.includes('India'));
            if (indianVoice) utterance.voice = indianVoice;

            utterance.pitch = 0.9;
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    };

    const sendCustomPrompt = async (promptText: string) => {
        if (!promptText.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: promptText,
        };

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            activeSessionId = Date.now().toString();
            setCurrentSessionId(activeSessionId);
        }

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        updateCurrentSession(newMessages, activeSessionId); // Save to session immediately

        setIsLoading(true);

        try {
            // Using relative URL to ensure it works properly locally and on Vercel
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    filter: activeFilter,
                    tone: tone,
                    sessionId: activeSessionId,
                    title: newMessages[0].content.slice(0, 30)
                }),
            });

            if (!response.ok) {
                let errText = '';
                try { errText = await response.text(); } catch(e) {}
                throw new Error(`Status ${response.status}: ${errText.slice(0, 150)}`);
            }
            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const aiMessageId = (Date.now() + 1).toString();
            const initialAiMessage: Message = { id: aiMessageId, role: 'assistant', content: '' };

            const messagesWithAi = [...newMessages, initialAiMessage];
            setMessages(messagesWithAi);

            let done = false;
            let accumulatedContent = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumulatedContent += chunk;

                    const updatedMessagesWithStreaming = messagesWithAi.map(m =>
                        m.id === aiMessageId ? { ...m, content: accumulatedContent } : m
                    );
                    setMessages(updatedMessagesWithStreaming);
                }
            }

            // Final update to session with complete message
            const finalMessages = messagesWithAi.map(m =>
                m.id === aiMessageId ? { ...m, content: accumulatedContent } : m
            );
            updateCurrentSession(finalMessages, activeSessionId);

        } catch (error: any) {
            console.error('Error fetching chat:', error);
            const errorDetail = error?.message || 'Unknown network error';
            const errorMsg: Message = { 
                id: (Date.now() + 2).toString(), 
                role: 'assistant', 
                content: `Sorry, I encountered an error connecting to the spiritual realm.\n\n*Details: ${errorDetail}*` 
            };
            const finalWithErr = [...newMessages, errorMsg];
            setMessages(finalWithErr);
            updateCurrentSession(finalWithErr, activeSessionId);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        const promptText = input;
        setInput('');
        await sendCustomPrompt(promptText);
    };

    const handleSelectVerseForDiscussion = (verseText: string, source: string) => {
        const prompt = `Please guide me further on this scripture passage from ${prettifySource(source)}: "${verseText}"`;
        sendCustomPrompt(prompt);
    };

    const handleContemplationSubmit = (promptText: string, reflectionText: string) => {
        setActiveTab('chat');
        const prompt = `Here is my reflection on today's Vedic prompt: "${promptText}"\n\nMy reflection:\n"${reflectionText}"\n\nPlease read my reflection, validate it with scriptural teachings, and provide your guidance.`;
        sendCustomPrompt(prompt);
    };

    const handleStudyDiscuss = (verseText: string, citation: string) => {
        setActiveTab('chat');
        const prompt = `Please guide me further on this verse from the ${citation}:\n\n"${verseText}"`;
        sendCustomPrompt(prompt);
    };

    const handleSaveToNotes = (content: string, title: string, citation?: string, verseText?: string) => {
        const cleanContent = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        const storedNotes = localStorage.getItem('garuda_library_notes');
        const notesList = storedNotes ? JSON.parse(storedNotes) : [];
        const newNote = {
            id: Math.random().toString(36).substring(2, 9),
            folderId: citation ? 'favorites' : 'unassigned',
            title: title || 'Saved Wisdom',
            content: cleanContent,
            verseCitation: citation,
            verseText: verseText,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        const updatedNotes = [newNote, ...notesList];
        localStorage.setItem('garuda_library_notes', JSON.stringify(updatedNotes));
        setSelectedNoteIdForLibrary(newNote.id);
        setActiveTab('library');
        alert("Saved to notes and opened in Library! 🕉️");
    };

    if (status === 'loading') {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--color-saffron-500)' }}><h3 style={{fontFamily: 'var(--font-serif)'}}>Communing...</h3></div>;
    }
    if (status === 'unauthenticated') {
        return <LoginModal />;
    }

    return (
        <div className={`app-layout ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {/* Sidebar Toggle (Mobile) */}
            <button className="sidebar-toggle" onClick={toggleSidebar}>
                <span style={{ fontSize: '1.2rem' }}>{isSidebarOpen ? '✕' : '☰'}</span>
            </button>

            {/* Overlay */}
            <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-body">
                    <button className="new-chat-btn" onClick={startNewChat}>
                        <span>+</span> New Chat
                    </button>
                    {sessions.length > 0 && (
                        <button 
                            className="delete-all-btn" 
                            onClick={deleteAllSessions}
                        >
                            🗑 Delete All Chats
                        </button>
                    )}

                    <div className="sidebar-section-title">Daily Wisdom</div>
                    <div className="sidebar-menu">
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'chat' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
                        >
                            <span>💬</span> Spiritual Guidance
                        </button>
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'quiz' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('quiz'); setIsSidebarOpen(false); }}
                        >
                            <span>📝</span> Daily Quiz & Prompt
                        </button>
                    </div>

                    <div className="sidebar-section-title">Scripture Course</div>
                    <div className="sidebar-menu">
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'study' && selectedStudyScripture === 'bg' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('study'); setSelectedStudyScripture('bg'); setIsSidebarOpen(false); }}
                        >
                            <span>📖</span> Bhagavad Gita
                        </button>
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'study' && selectedStudyScripture === 'uddhava' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('study'); setSelectedStudyScripture('uddhava'); setIsSidebarOpen(false); }}
                        >
                            <span>🌺</span> Uddhava Gita
                        </button>
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'study' && selectedStudyScripture === 'bhagavatam' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('study'); setSelectedStudyScripture('bhagavatam'); setIsSidebarOpen(false); }}
                        >
                            <span>🪷</span> Śrīmad Bhāgavatam
                        </button>
                    </div>

                    <div className="sidebar-section-title">My Library</div>
                    <div className="sidebar-menu">
                        <button 
                            className={`sidebar-menu-btn ${activeTab === 'library' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('library'); setIsSidebarOpen(false); }}
                        >
                            <span>📚</span> Sacred Library & Notes
                        </button>
                    </div>

                    <div className="sidebar-section-title">Chat History</div>

                    <div className="session-list">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                                onClick={() => selectSession(session.id)}
                            >
                                <div className="session-item-content">
                                    <div className="session-title">{session.title}</div>
                                    <div className="session-date">{new Date(session.timestamp).toLocaleDateString()}</div>
                                </div>
                                <button
                                    className="session-delete-btn"
                                    onClick={(e) => deleteSession(e, session.id)}
                                    title="Delete chat"
                                    aria-label="Delete chat"
                                >
                                    🗑
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar Footer: Account info + actions (ChatGPT-style) */}
                <div className="sidebar-footer">
                    <div className="sidebar-footer-divider" />



                    {/* Sign Out row */}
                    <button
                        onClick={() => signOut()}
                        className="sidebar-footer-btn"
                        style={{ background: 'rgba(255,80,80,0.07)', borderColor: 'rgba(255,80,80,0.2)', color: '#ff8585', marginBottom: '0.5rem' }}
                    >
                        <span>↪</span>
                        <span>Sign Out</span>
                    </button>

                    {/* User info row */}
                    <div className="sidebar-user-row">
                        <div className="sidebar-user-avatar">
                            {(session?.user?.name || session?.user?.email || 'U')[0].toUpperCase()}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-username">{session?.user?.name || session?.user?.email || 'User'}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', opacity: 0.7 }}>Signed in</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="main-workspace">
                {/* Main Content */}
                <header className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {/* Space for sidebar toggle on mobile */}
                    <div style={{ width: '40px', display: 'block' }} className="mobile-spacer"></div>

                    <div style={{ textAlign: 'center', flexGrow: 1 }}>
                        <h1 className={styles.title}>Garuda AI</h1>
                        <p className={styles.subtitle}>Sacred Intelligence</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', width: 'auto', minWidth: '40px', justifyContent: 'flex-end', alignItems: 'center' }} suppressHydrationWarning>
                        <button onClick={toggleTheme} className={styles.themeToggle} title="Toggle Theme" suppressHydrationWarning>
                            {theme === 'dharma' ? '🌙' : '🌿'}
                        </button>
                    </div>
                </div>
            </header>

            {activeTab === 'quiz' ? (
                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    <VedicQuiz onSubmitReflection={handleContemplationSubmit} />
                </div>
            ) : activeTab === 'study' ? (
                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    <ScriptureStudy 
                        scriptureId={selectedStudyScripture} 
                        onAskGaruda={handleStudyDiscuss} 
                        onSaveToNotes={handleSaveToNotes}
                    />
                </div>
            ) : activeTab === 'library' ? (
                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    <LibraryNotes 
                        initialSelectedNoteId={selectedNoteIdForLibrary}
                        onClearInitialNoteId={() => setSelectedNoteIdForLibrary(null)}
                    />
                </div>
            ) : (
                <>
                    <div className={styles.chatWindow}>
                        {messages.length === 0 ? (
                            <div className={styles.emptyState}>
                                <MoodGuidance onSelectVerse={handleSelectVerseForDiscussion} />
                                <div className={styles.om}>ॐ</div>
                                <h2 className={styles.emptyStateTitle}>Divine Intelligence</h2>
                                <p className={styles.emptyStateDesc}>Seek wisdom from the eternal scriptures. Ask a question about life, dharma, or spiritual truth.</p>
                                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.5 }}>Examples: &quot;Why do we suffer?&quot;, &quot;What is Dharma?&quot;, &quot;How to find inner peace?&quot;</p>
                            </div>
                        ) : (
                            messages.map((m) => (
                                <div
                                    key={m.id}
                                    className={`${styles.message} ${m.role === 'user' ? styles.userMessage : styles.aiMessage
                                        }`}
                                >
                                    <div
                                        className="whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{ 
                                            __html: m.content
                                                .replace(/\n/g, '<br/>')
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\[Source: (.*?)\]/g, (_match: string, filename: string) => 
                                                    `<span class="citation">📜 ${prettifySource(filename)}</span>`
                                                )
                                        }}
                                    />
                                    {m.role === 'assistant' && !isLoading && (
                                        <div style={{
                                            position: 'absolute', bottom: '-20px', left: '0',
                                            display: 'flex', gap: '16px', alignItems: 'center'
                                        }}>
                                            <button
                                                onClick={() => speak(m.content)}
                                                style={{
                                                    background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                                                    fontSize: '0.8rem', cursor: 'pointer', opacity: 0.7
                                                }}
                                            >
                                                🔊 Listen
                                            </button>
                                            <button
                                                onClick={() => handleSaveToNotes(m.content, `Reflections on: ${m.content.replace(/<[^>]*>/g, '').slice(0, 30)}...`, "Garuda Chat Response")}
                                                style={{
                                                    background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                                                    fontSize: '0.8rem', cursor: 'pointer', opacity: 0.7
                                                }}
                                            >
                                                📝 Take Note
                                            </button>
                                            <button
                                                onClick={() => handleReportClick(m.id, m.content)}
                                                style={{
                                                    background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                                                    fontSize: '0.8rem', cursor: 'pointer', opacity: 0.7
                                                }}
                                            >
                                                🚩 Report Issue
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                            <div className={styles.contemplatingWrapper}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <div className={styles.dots}>
                                        <div className={styles.dot} />
                                        <div className={styles.dot} />
                                        <div className={styles.dot} />
                                    </div>
                                    <span className={styles.contemplatingText}>Searching the scriptures…</span>
                                </div>
                                <div className={styles.contemplatingBooks}>
                                    {(activeFilter === 'all' ? ['Bhagavad Gita', 'Uddhava Gita', 'Śrīmad Bhāgavatam'] :
                                        activeFilter === 'bg' ? ['Bhagavad Gita'] :
                                        activeFilter === 'uddhava' ? ['Uddhava Gita'] :
                                        ['Śrīmad Bhāgavatam']
                                    ).map(book => (
                                        <span key={book} className={styles.contemplatingBook}>📜 {book}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.inputArea}>
                        {/* Dropdown Options Row (Spacious & Clean) */}
                        <div className={styles.optionsRow}>
                            {/* Search Dropdown */}
                            <div className={styles.dropdownContainer}>
                                <button 
                                    type="button"
                                    className={`${styles.dropdownTrigger} ${isSearchOpen ? styles.dropdownActive : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsSearchOpen(!isSearchOpen);
                                        setIsToneOpen(false);
                                    }}
                                >
                                    🔍 Search: {BOOKS.find(b => b.id === activeFilter)?.label || 'All'} ▾
                                </button>
                                {isSearchOpen && (
                                    <div className={styles.dropdownMenu}>
                                        {BOOKS.map(book => (
                                            <button
                                                key={book.id}
                                                type="button"
                                                className={`${styles.dropdownItem} ${activeFilter === book.id ? styles.itemActive : ''}`}
                                                onClick={() => {
                                                    setActiveFilter(book.id);
                                                    setIsSearchOpen(false);
                                                }}
                                            >
                                                {book.icon} {book.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tone Dropdown */}
                            <div className={styles.dropdownContainer}>
                                <button 
                                    type="button"
                                    className={`${styles.dropdownTrigger} ${isToneOpen ? styles.dropdownActive : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsToneOpen(!isToneOpen);
                                        setIsSearchOpen(false);
                                    }}
                                >
                                    🎭 Tone: {TONES.find(t => t.id === tone)?.label || 'Traditional'} ▾
                                </button>
                                {isToneOpen && (
                                    <div className={styles.dropdownMenu}>
                                        {TONES.map(t => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                className={`${styles.dropdownItem} ${tone === t.id ? styles.itemActive : ''}`}
                                                onClick={() => {
                                                    setTone(t.id as any);
                                                    setIsToneOpen(false);
                                                }}
                                            >
                                                {t.icon} {t.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <form onSubmit={handleSubmit} className={styles.form}>
                            <input
                                className={styles.input}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask a question about life, dharma, or spirituality..."
                                disabled={isLoading}
                                suppressHydrationWarning
                            />
                            <button type="submit" className={styles.sendButton} disabled={isLoading || !input.trim()}>
                                {isLoading ? (
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                )}
                            </button>
                        </form>
                    </div>
                </>
            )}

            {reportingMessage && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        background: '#1a1a1a', // standard dark bg
                        border: '1px solid rgba(212, 175, 55, 0.3)',
                        borderRadius: '16px',
                        padding: '2rem',
                        width: '90%',
                        maxWidth: '450px',
                        color: '#f0f0f0',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-saffron-500)', fontSize: '1.25rem', marginBottom: '1rem', marginTop: 0 }}>🚩 Report AI Response</h3>
                        <p style={{ fontSize: '0.88rem', opacity: 0.8, marginBottom: '1.25rem', lineHeight: '1.4' }}>Help us maintain scriptural accuracy and safety. Please specify the issue with this AI-generated response:</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                <input type="radio" name="reason" value="inappropriate" checked={reportReason === 'inappropriate'} onChange={(e) => setReportReason(e.target.value)} />
                                Inappropriate or offensive language
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                <input type="radio" name="reason" value="harmful" checked={reportReason === 'harmful'} onChange={(e) => setReportReason(e.target.value)} />
                                Harmful or dangerous guidance
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                <input type="radio" name="reason" value="inaccurate" checked={reportReason === 'inaccurate'} onChange={(e) => setReportReason(e.target.value)} />
                                Scripturally inaccurate or misleading
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                <input type="radio" name="reason" value="other" checked={reportReason === 'other'} onChange={(e) => setReportReason(e.target.value)} />
                                Other issue
                            </label>
                        </div>

                        <textarea
                            value={reportDetails}
                            onChange={(e) => setReportDetails(e.target.value)}
                            placeholder="Additional details (optional)..."
                            style={{
                                width: '100%',
                                height: '80px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '0.75rem',
                                color: '#f0f0f0',
                                fontSize: '0.9rem',
                                resize: 'none',
                                marginBottom: '1.5rem',
                                outline: 'none'
                            }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                onClick={() => {
                                    setReportingMessage(null);
                                    setReportDetails('');
                                }}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1rem',
                                    color: '#f0f0f0',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReport}
                                style={{
                                    background: 'linear-gradient(135deg, var(--color-saffron-500), var(--color-saffron-700))',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.5rem 1.25rem',
                                    color: '#1a1a1a',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
            </div> {/* Closing main-workspace */}
        </div>
    );
}
