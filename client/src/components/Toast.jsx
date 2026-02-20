import { useEffect } from 'react';

function Toast({ message, onClose }) {
    useEffect(() => {
        if (message) {
            const timer = setTimeout(onClose, 5000);
            return () => clearTimeout(timer);
        }
    }, [message, onClose]);

    if (!message) return null;

    return (
        <div className="toast-container">
            <div className="toast">
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <span className="toast-message">{message}</span>
                <button className="toast-close" onClick={onClose}>✕</button>
            </div>
        </div>
    );
}

export default Toast;
