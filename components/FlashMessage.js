'use client';

import { useState, useEffect, useCallback } from 'react';

export default function FlashMessage({ type, message, onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    const handleClose = useCallback(() => {
        setIsVisible(false);
        setTimeout(() => {
            if (onClose) onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, 5000);

        return () => clearTimeout(timer);
    }, [handleClose]);

    const getIcon = () => {
        switch (type) {
            case 'error':
                return 'fas fa-exclamation-triangle';
            case 'warning':
                return 'fas fa-exclamation-circle';
            case 'info':
                return 'fas fa-info-circle';
            case 'success':
            default:
                return 'fas fa-check-circle';
        }
    };

    if (!isVisible) return null;

    return (
        <div className={`flash-message flash-${type}`} style={{
            opacity: isVisible ? '1' : '0',
            transform: isVisible ? 'translateY(0)' : 'translateY(-20px)'
        }}>
            <i className={`${getIcon()} me-2`}></i>
            {message}
            <button type="button" onClick={handleClose}>
                ×
            </button>
        </div>
    );
}

export function FlashContainer({ messages, onRemoveMessage }) {
    if (!messages || messages.length === 0) return null;

    return (
        <div className="flash-messages">
            {messages.map((msg, index) => (
                <FlashMessage
                    key={index}
                    type={msg.type}
                    message={msg.message}
                    onClose={() => onRemoveMessage && onRemoveMessage(index)}
                />
            ))}
        </div>
    );
} 