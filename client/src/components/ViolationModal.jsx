function ViolationModal({ message, onClose }) {
    if (!message) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-icon">🚫</div>
                <div className="modal-title">Movement Violation</div>
                <div className="modal-message">{message}</div>
                <button className="modal-close" onClick={onClose}>
                    Dismiss
                </button>
            </div>
        </div>
    );
}

export default ViolationModal;
