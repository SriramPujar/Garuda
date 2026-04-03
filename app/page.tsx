'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import styles from './page.module.css';
import DailyQuote from './components/DailyQuote';
import LoginModal from './components/LoginModal';
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

export default function Chat() {
    const { data: session, status } = useSession();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isNative, setIsNative] = useState(false);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'dharma' | 'forest'>('dharma');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

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
        
        // Optimistic UI
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSessionId === sessionId) {
            setCurrentSessionId(null);
            setMessages([]);
        }

        // Delete from server
        try {
            await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
        } catch (e) {
            console.error('Failed to delete', e);
        }
    };

    const deleteAllSessions = async () => {
        if (window.confirm("Are you sure you want to delete all historical chats?")) {
            const sessionsToDelete = [...sessions];
            setSessions([]);
            setCurrentSessionId(null);
            setMessages([]);
            setIsSidebarOpen(false);
            
            // Delete all individually
            for (const s of sessionsToDelete) {
                await fetch(`/api/sessions/${s.id}`, { method: 'DELETE' });
            }
        }
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        let activeSessionId = currentSessionId;
        if (!activeSessionId) {
            activeSessionId = Date.now().toString();
            setCurrentSessionId(activeSessionId);
        }

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        updateCurrentSession(newMessages, activeSessionId); // Save to session immediately

        setInput('');
        setIsLoading(true);

        try {
        // Using relative URL to ensure it works properly locally and on Vercel
        const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    filter: activeFilter,
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
            // Temporary placeholder for AI message
            const initialAiMessage: Message = { id: aiMessageId, role: 'assistant', content: '' };

            const messagesWithAi = [...newMessages, initialAiMessage];
            setMessages(messagesWithAi);

            let done = false;
            let accumuluatedContent = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumuluatedContent += chunk;

                    const updatedMessagesWithStreaming = messagesWithAi.map(m =>
                        m.id === aiMessageId ? { ...m, content: accumuluatedContent } : m
                    );
                    setMessages(updatedMessagesWithStreaming);
                    // Note: We typically don't update session storage on every chunk to save performance,
                    // but we should update it at the end.
                }
            }

            // Final update to session with complete message
            const finalMessages = messagesWithAi.map(m =>
                m.id === aiMessageId ? { ...m, content: accumuluatedContent } : m
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

    if (status === 'loading') {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--color-saffron-500)' }}><h3 style={{fontFamily: 'var(--font-serif)'}}>Communing...</h3></div>;
    }
    if (status === 'unauthenticated') {
        return <LoginModal />;
    }

    return (
        <div className={styles.container}>
            {/* Sidebar Toggle (Mobile) */}
            <button className="sidebar-toggle" onClick={toggleSidebar}>
                <span style={{ fontSize: '1.2rem' }}>☰</span>
            </button>

            {/* Overlay */}
            <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)} />

            {/* Sidebar */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <button className="new-chat-btn" onClick={startNewChat}>
                    <span>+</span> New Chat
                </button>
                {sessions.length > 0 && (
                    <button 
                        className="new-chat-btn" 
                        style={{background: 'rgba(255, 80, 80, 0.1)', color: '#ff6b6b', marginTop: '-0.5rem', marginBottom: '1rem', border: '1px solid rgba(255, 80, 80, 0.2)'}} 
                        onClick={deleteAllSessions}
                    >
                        🗑 Delete All Chats
                    </button>
                )}

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

                {/* Sidebar Footer: Account info + actions (ChatGPT-style) */}
                <div className="sidebar-footer">
                    <div className="sidebar-footer-divider" />

                    {/* Install App — always visible */}
                    <button
                        onClick={handleInstallClick}
                        className="sidebar-footer-btn install-btn"
                    >
                        <span>📱</span>
                        <span>{isNative ? 'App Installed ✓' : 'Install App'}</span>
                    </button>

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
                        <button onClick={toggleTheme} style={{ width: '40px', height: '40px', flexShrink: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', color: 'var(--color-saffron-500)', cursor: 'pointer', transition: 'all 0.3s ease' }} title="Toggle Theme" suppressHydrationWarning>
                            {theme === 'dharma' ? '🌙' : '🌿'}
                        </button>
                    </div>
                </div>
            </header>

            <div className={styles.chatWindow}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <DailyQuote />
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
                                <button
                                    onClick={() => speak(m.content)}
                                    style={{
                                        position: 'absolute', bottom: '-20px', left: '0',
                                        background: 'transparent', border: 'none', color: 'var(--color-text-secondary)',
                                        fontSize: '0.8rem', cursor: 'pointer', opacity: 0.7
                                    }}
                                >
                                    🔊 Listen
                                </button>
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
                {/* Book Filter Chips */}
                <div className={styles.filterBar} style={{ marginBottom: '0.75rem', width: '100%', maxWidth: '800px' }}>
                    <span className={styles.filterLabel}>Search in:</span>
                    {BOOKS.map(book => (
                        <button
                            key={book.id}
                            type="button"
                            className={`${styles.filterChip} ${activeFilter === book.id ? styles.filterChipActive : ''}`}
                            onClick={() => setActiveFilter(book.id)}
                        >
                            {book.icon} {book.label}
                        </button>
                    ))}
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
        </div>
    );
}
