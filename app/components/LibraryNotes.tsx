import { useState, useEffect } from 'react';
import styles from './LibraryNotes.module.css';

interface Folder {
    id: string;
    name: string;
    createdAt: number;
}

interface Note {
    id: string;
    folderId: string;
    title: string;
    content: string;
    verseCitation?: string;
    verseText?: string;
    createdAt: number;
    updatedAt: number;
}

interface LibraryNotesProps {
    initialSelectedNoteId?: string | null;
    onClearInitialNoteId?: () => void;
}

export default function LibraryNotes({ initialSelectedNoteId, onClearInitialNoteId }: LibraryNotesProps) {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string>('all');
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    // Form inputs for note editing
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editFolderId, setEditFolderId] = useState('unassigned');

    // Folder creation input
    const [newFolderName, setNewFolderName] = useState('');

    // Load initial folders/notes
    useEffect(() => {
        const storedFolders = localStorage.getItem('garuda_library_folders');
        if (storedFolders) {
            setFolders(JSON.parse(storedFolders));
        } else {
            const defaultFolders = [
                { id: 'unassigned', name: 'General Notes', createdAt: Date.now() },
                { id: 'favorites', name: 'Favorite Verses', createdAt: Date.now() },
                { id: 'reflections', name: 'Self Reflections', createdAt: Date.now() }
            ];
            setFolders(defaultFolders);
            localStorage.setItem('garuda_library_folders', JSON.stringify(defaultFolders));
        }

        const storedNotes = localStorage.getItem('garuda_library_notes');
        if (storedNotes) {
            setNotes(JSON.parse(storedNotes));
        } else {
            const defaultNotes = [
                {
                    id: 'welcome-note',
                    folderId: 'unassigned',
                    title: 'Welcome to your Sacred Library',
                    content: 'This is your spiritual library. Here you can capture reflections, save sacred verses from courses, or clip Garuda\'s guidance directly.\n\nUse the sidebar to create custom categories (folders) to organize your thoughts. Hare Krishna! 🕉️',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                }
            ];
            setNotes(defaultNotes);
            localStorage.setItem('garuda_library_notes', JSON.stringify(defaultNotes));
        }
    }, []);

    // Handle externally triggered note selection (e.g. from saving a verse/chat response)
    useEffect(() => {
        if (initialSelectedNoteId && notes.length > 0) {
            const match = notes.find(n => n.id === initialSelectedNoteId);
            if (match) {
                setSelectedNoteId(initialSelectedNoteId);
                setEditTitle(match.title);
                setEditContent(match.content);
                setEditFolderId(match.folderId);
                setActiveFolderId('all'); // Show all notes so they can see it in context
            }
            if (onClearInitialNoteId) {
                onClearInitialNoteId();
            }
        }
    }, [initialSelectedNoteId, notes, onClearInitialNoteId]);

    // Save folders to localStorage
    const saveFoldersToStorage = (updatedFolders: Folder[]) => {
        setFolders(updatedFolders);
        localStorage.setItem('garuda_library_folders', JSON.stringify(updatedFolders));
    };

    // Save notes to localStorage
    const saveNotesToStorage = (updatedNotes: Note[]) => {
        setNotes(updatedNotes);
        localStorage.setItem('garuda_library_notes', JSON.stringify(updatedNotes));
    };

    // Folder Actions
    const handleAddFolder = (e: React.FormEvent) => {
        e.preventDefault();
        const name = newFolderName.trim();
        if (!name) return;

        const newFolder: Folder = {
            id: Math.random().toString(36).substring(2, 9),
            name,
            createdAt: Date.now()
        };

        const updated = [...folders, newFolder];
        saveFoldersToStorage(updated);
        setNewFolderName('');
    };

    const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (folderId === 'unassigned') {
            alert("The General Notes folder cannot be deleted.");
            return;
        }

        if (confirm("Are you sure you want to delete this category folder? Notes inside this folder will be moved to General Notes.")) {
            const updatedFolders = folders.filter(f => f.id !== folderId);
            saveFoldersToStorage(updatedFolders);

            // Reassign notes
            const updatedNotes = notes.map(note => {
                if (note.folderId === folderId) {
                    return { ...note, folderId: 'unassigned', updatedAt: Date.now() };
                }
                return note;
            });
            saveNotesToStorage(updatedNotes);

            if (activeFolderId === folderId) {
                setActiveFolderId('all');
            }
        }
    };

    // Note Actions
    const handleCreateNote = () => {
        const folderToUse = activeFolderId === 'all' ? 'unassigned' : activeFolderId;
        const newNote: Note = {
            id: Math.random().toString(36).substring(2, 9),
            folderId: folderToUse,
            title: 'New Note',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const updated = [newNote, ...notes];
        saveNotesToStorage(updated);

        // Select and open the newly created note in editor
        setSelectedNoteId(newNote.id);
        setEditTitle(newNote.title);
        setEditContent(newNote.content);
        setEditFolderId(newNote.folderId);
    };

    const handleSelectNote = (note: Note) => {
        setSelectedNoteId(note.id);
        setEditTitle(note.title);
        setEditContent(note.content);
        setEditFolderId(note.folderId);
    };

    const handleSaveNote = () => {
        if (!selectedNoteId) return;

        const updated = notes.map(note => {
            if (note.id === selectedNoteId) {
                return {
                    ...note,
                    title: editTitle.trim() || 'Untitled Note',
                    content: editContent,
                    folderId: editFolderId,
                    updatedAt: Date.now()
                };
            }
            return note;
        });

        saveNotesToStorage(updated);
        alert("Note saved successfully! 🕉️");
    };

    const handleDeleteNote = (noteId: string) => {
        if (confirm("Are you sure you want to delete this note?")) {
            const updated = notes.filter(n => n.id !== noteId);
            saveNotesToStorage(updated);
            if (selectedNoteId === noteId) {
                setSelectedNoteId(null);
            }
        }
    };

    const handleCopyNote = () => {
        if (!editContent) return;
        navigator.clipboard.writeText(editContent)
            .then(() => alert("Note content copied to clipboard!"))
            .catch(err => console.error("Could not copy text: ", err));
    };

    // Filter notes based on active folder
    const filteredNotes = notes.filter(note => {
        if (activeFolderId === 'all') return true;
        return note.folderId === activeFolderId;
    });

    const activeNote = notes.find(n => n.id === selectedNoteId);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.icon}>📚</span>
                <h2 className={styles.title}>Sacred Library & Notes</h2>
                <p className={styles.subtitle}>Study scriptures, save verses, and document your spiritual reflections.</p>
            </div>

            <div className={styles.layout}>
                {/* ── Folders Navigation Panel ── */}
                <div className={styles.foldersCard}>
                    <h3 className={styles.sectionTitle}>Folders</h3>
                    <div className={styles.folderList}>
                        <button 
                            className={`${styles.folderBtn} ${activeFolderId === 'all' ? styles.folderActive : ''}`}
                            onClick={() => { setActiveFolderId('all'); setSelectedNoteId(null); }}
                        >
                            <span>📂 All Notes</span>
                            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({notes.length})</span>
                        </button>

                        {folders.map(folder => {
                            const count = notes.filter(n => n.folderId === folder.id).length;
                            return (
                                <button 
                                    key={folder.id}
                                    className={`${styles.folderBtn} ${activeFolderId === folder.id ? styles.folderActive : ''}`}
                                    onClick={() => { setActiveFolderId(folder.id); setSelectedNoteId(null); }}
                                >
                                    <span>📁 {folder.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({count})</span>
                                        {folder.id !== 'unassigned' && (
                                            <span 
                                                className={styles.folderDeleteBtn}
                                                onClick={(e) => handleDeleteFolder(folder.id, e)}
                                                title="Delete folder"
                                            >
                                                ✕
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <form onSubmit={handleAddFolder} className={styles.addFolderForm}>
                        <input 
                            type="text" 
                            className={styles.folderInput}
                            placeholder="+ Create folder..."
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            maxLength={20}
                        />
                        <button type="submit" className={styles.addFolderBtn}>+</button>
                    </form>
                </div>

                {/* ── Main Notes Workspace ── */}
                <div className={styles.workspace}>
                    {!selectedNoteId ? (
                        <>
                            {/* Notes List View */}
                            <div className={styles.actionRow}>
                                <h3 className={styles.sectionTitle} style={{ border: 'none', padding: 0 }}>
                                    {activeFolderId === 'all' 
                                        ? "All Notes" 
                                        : `${folders.find(f => f.id === activeFolderId)?.name || 'Notes'}`}
                                </h3>
                                <button className={styles.createNoteBtn} onClick={handleCreateNote}>
                                    + Create Note
                                </button>
                            </div>

                            {filteredNotes.length > 0 ? (
                                <div className={styles.notesGrid}>
                                    {filteredNotes.map(note => (
                                        <div 
                                            key={note.id}
                                            className={styles.noteCard}
                                            onClick={() => handleSelectNote(note)}
                                        >
                                            <div>
                                                {note.verseCitation && (
                                                    <span className={styles.badge}>📿 {note.verseCitation}</span>
                                                )}
                                                <h4 className={styles.noteCardTitle}>{note.title}</h4>
                                                <p className={styles.noteCardExcerpt}>
                                                    {note.content || "Empty note... Click to start writing."}
                                                </p>
                                            </div>
                                            <div className={styles.noteCardFooter}>
                                                <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                                                <span>✍️</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className={styles.emptyState}>
                                    <span className={styles.emptyIcon}>✍️</span>
                                    <h4 className={styles.emptyTitle}>No notes found</h4>
                                    <p className={styles.emptyDesc}>Click "+ Create Note" above to begin documenting your spiritual studies.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        /* ── Note Editor View ── */
                        <div className={styles.editorCard}>
                            <div className={styles.editorHeader}>
                                <h3 className={styles.sectionTitle} style={{ border: 'none', padding: 0 }}>
                                    Editing Note
                                </h3>
                                <button className={styles.editorCloseBtn} onClick={() => setSelectedNoteId(null)}>
                                    ✕ Close Editor
                                </button>
                            </div>

                            <div className={styles.editorFields}>
                                <input 
                                    type="text" 
                                    className={styles.editorTitleInput}
                                    placeholder="Enter note title..."
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                />

                                <div className={styles.editorMetaRow}>
                                    <div className={styles.metaLabel}>
                                        <span>Folder:</span>
                                        <select 
                                            className={styles.editorSelect}
                                            value={editFolderId}
                                            onChange={(e) => setEditFolderId(e.target.value)}
                                        >
                                            <option value="unassigned">General Notes</option>
                                            {folders.map(f => (
                                                <option key={f.id} value={f.id}>{f.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {activeNote?.verseCitation && (
                                        <span className={styles.badge} style={{ margin: 0 }}>
                                            Linked to: {activeNote.verseCitation}
                                        </span>
                                    )}
                                </div>

                                {activeNote?.verseText && (
                                    <div className={styles.citationCard}>
                                        <div className={styles.citationTitle}>Reference Verse:</div>
                                        <pre className={styles.citationText}>{activeNote.verseText}</pre>
                                    </div>
                                )}

                                <textarea 
                                    className={styles.editorTextarea}
                                    placeholder="Write down your spiritual reflection, notes, study takeaways or copy-paste AI responses here..."
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                />
                            </div>

                            <div className={styles.editorActions}>
                                <button className={styles.deleteBtn} onClick={() => handleDeleteNote(selectedNoteId)}>
                                    🗑 Delete
                                </button>

                                <div className={styles.btnGroup}>
                                    <button className={styles.copyBtn} onClick={handleCopyNote}>
                                        📋 Copy
                                    </button>
                                    <button className={styles.saveBtn} onClick={handleSaveNote}>
                                        💾 Save Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
