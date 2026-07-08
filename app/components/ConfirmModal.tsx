import React from 'react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
    isOpen: boolean;
    title?: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmModal({ isOpen, title = "Garuda AI", message, onConfirm, onCancel }: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <span className={styles.logoIcon}>🕉</span>
                    <h3 className={styles.title}>{title}</h3>
                </div>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={onCancel}>
                        Cancel
                    </button>
                    <button className={styles.confirmBtn} onClick={onConfirm}>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}
