'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';
import DailyQuote from './components/DailyQuote';

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

export default function Chat() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'dharma' | 'forest'>('dharma');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Initialize: Load Theme & Sessions
    useEffect(() => {
        // Theme
        const savedTheme = localStorage.getItem('garuda-theme') as 'dharma' | 'forest';
        if (savedTheme) setTheme(savedTheme);

        // Sessions
        const savedSessions = localStorage.getItem('garuda-sessions');
        if (savedSessions) {
            try {
                const parsed = JSON.parse(savedSessions);
                setSessions(parsed);
                // Load most recent session if exists
                if (parsed.length > 0) {
                    const mostRecent = parsed[0];
                    setCurrentSessionId(mostRecent.id);
                    setMessages(mostRecent.messages);
                }
            } catch (e) {
                console.error("Failed to load sessions", e);
            }
        } else {
            // Migration: Check for old single-session history
            const oldHistory = localStorage.getItem('garuda-chat-history');
            if (oldHistory) {
                try {
                    const oldMessages = JSON.parse(oldHistory);
                    if (oldMessages.length > 0) {
                        const newSession: Session = {
                            id: Date.now().toString(),
                            title: 'Previous Chat',
                            timestamp: Date.now(),
                            messages: oldMessages
                        };
                        setSessions([newSession]);
                        setCurrentSessionId(newSession.id);
                        setMessages(oldMessages);
                        localStorage.setItem('garuda-sessions', JSON.stringify([newSession]));
                        localStorage.removeItem('garuda-chat-history'); // Cleanup
                    }
                } catch (e) { }
            }
        }
    }, []);

    // Effect: Sync Theme changes
    useEffect(() => {
        localStorage.setItem('garuda-theme', theme);
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    // Effect: Save Sessions whenever they change
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem('garuda-sessions', JSON.stringify(sessions));
        }
    }, [sessions]);

    // Effect: Scroll on message update
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    const updateCurrentSession = (updatedMessages: Message[]) => {
        setSessions(prev => {
            let newSessions = [...prev];

            if (currentSessionId) {
                // Update existing
                const index = newSessions.findIndex(s => s.id === currentSessionId);
                if (index !== -1) {
                    newSessions[index] = { ...newSessions[index], messages: updatedMessages };
                    // Move to top
                    const moved = newSessions.splice(index, 1)[0];
                    newSessions.unshift(moved);
                }
            } else {
                // Create new session
                // Generate title from first message
                const firstUserMsg = updatedMessages.find(m => m.role === 'user');
                const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '') : 'New Chat';

                const newId = Date.now().toString();
                const newSession: Session = {
                    id: newId,
                    title: title,
                    timestamp: Date.now(),
                    messages: updatedMessages
                };
                newSessions.unshift(newSession);
                setCurrentSessionId(newId);
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

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        updateCurrentSession(newMessages); // Save to session immediately

        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                }),
            });

            if (!response.ok) throw new Error('Network response was not ok');
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
            updateCurrentSession(finalMessages);

        } catch (error) {
            console.error('Error fetching chat:', error);
            const errorMsg: Message = { id: (Date.now() + 2).toString(), role: 'assistant', content: 'Sorry, I encountered an error connecting to the spiritual realm.' };
            const finalWithErr = [...newMessages, errorMsg];
            setMessages(finalWithErr);
            updateCurrentSession(finalWithErr);
        } finally {
            setIsLoading(false);
        }
    };

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

                <div className="session-list">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            className={`session-item ${currentSessionId === session.id ? 'active' : ''}`}
                            onClick={() => selectSession(session.id)}
                        >
                            <div className="session-title">{session.title}</div>
                            <div className="session-date">{new Date(session.timestamp).toLocaleDateString()}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <header className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    {/* Space for sidebar toggle on mobile */}
                    <div style={{ width: '40px', display: 'block' }} className="mobile-spacer"></div>

                    <div style={{ textAlign: 'center', flexGrow: 1 }}>
                        <h1 className={styles.title}>Garuda v2</h1>
                        <p className={styles.subtitle}>Wisdom from the Eternal Scriptures</p>
                    </div>

                    <button onClick={toggleTheme} className={styles.sendButton} style={{ width: '36px', height: '36px', background: 'transparent', border: '1px solid var(--color-saffron-500)' }} title="Toggle Theme" suppressHydrationWarning>
                        {theme === 'dharma' ? '🌙' : '🌿'}
                    </button>
                </div>
            </header>

            <DailyQuote />

            <div className={styles.chatWindow}>
                {messages.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.om}>ॐ</div>
                        <p>Ask a question to receive guidance from the ancient texts.</p>
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>Examples: &quot;Why do we suffer?&quot;, &quot;What is Dharma?&quot;, &quot;How to find peace?&quot;</p>
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
                                dangerouslySetInnerHTML={{ __html: m.content.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
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
                    <div className={`${styles.message} ${styles.aiMessage}`}>
                        <span style={{ color: 'var(--color-gold-500)' }}>Contemplating the scriptures...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles.inputArea}>
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
