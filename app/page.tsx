'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './page.module.css';
import DailyQuote from './components/DailyQuote';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export default function Chat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [theme, setTheme] = useState<'dharma' | 'forest'>('dharma');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load persistence & theme
    useEffect(() => {
        const savedMsg = localStorage.getItem('garuda-chat-history');
        if (savedMsg) {
            try { setMessages(JSON.parse(savedMsg)); } catch (e) { }
        }
        const savedTheme = localStorage.getItem('garuda-theme') as 'dharma' | 'forest';
        if (savedTheme) setTheme(savedTheme);
    }, []);

    // Save persistence & theme
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('garuda-chat-history', JSON.stringify(messages));
        }
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        localStorage.setItem('garuda-theme', theme);
        document.body.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dharma' ? 'forest' : 'dharma');
    };

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop previous
            const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, '')); // Strip markdown
            // Try to find a good voice usually Indian English if available, or just default
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

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMessage],
                }),
            });

            if (!response.ok) throw new Error('Network response was not ok');
            if (!response.body) return;

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const aiMessageId = (Date.now() + 1).toString();
            setMessages((prev) => [
                ...prev,
                { id: aiMessageId, role: 'assistant', content: '' },
            ]);

            let done = false;
            let accumuluatedContent = '';

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    accumuluatedContent += chunk;

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === aiMessageId
                                ? { ...m, content: accumuluatedContent }
                                : m
                        )
                    );
                }
            }

        } catch (error) {
            console.error('Error fetching chat:', error);
            setMessages((prev) => [
                ...prev,
                { id: (Date.now() + 2).toString(), role: 'assistant', content: 'Sorry, I encountered an error connecting to the spiritual realm.' },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <button onClick={toggleTheme} className={styles.sendButton} style={{ width: '36px', height: '36px', background: 'transparent', border: '1px solid var(--color-saffron-500)' }} title="Toggle Theme" suppressHydrationWarning>
                        {theme === 'dharma' ? '🌙' : '🌿'}
                    </button>
                    <div style={{ textAlign: 'center', flexGrow: 1 }}>
                        <h1 className={styles.title}>Garuda</h1>
                        <p className={styles.subtitle}>Wisdom from the Eternal Scriptures</p>
                    </div>
                    <div style={{ width: '36px' }}></div> {/* Spacer */}
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
