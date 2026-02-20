function getEventColor(type) {
    if (type === 'VIOLATION' || type === 'REJECTED') return 'var(--red)';
    if (type === 'INVOICE_GENERATED') return 'var(--purple)';
    if (type === 'DOCK_ENTRY') return 'var(--amber)';
    if (type === 'SESSION_EXIT') return 'var(--text-dim)';
    return 'var(--blue)';
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

function EventLog({ events }) {
    return (
        <div className="card">
            <div className="card-title">📋 Event Log</div>
            {events.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-state-icon">📋</div>
                    <p>No events yet</p>
                </div>
            ) : (
                <div className="event-log">
                    {events.map((evt, i) => (
                        <div
                            key={evt._id || i}
                            className={`event-item ${evt.eventType === 'VIOLATION' ? 'violation' : ''}`}
                        >
                            <div className="event-type" style={{ color: getEventColor(evt.eventType) }}>
                                {evt.eventType}
                            </div>
                            <div className="event-message">{evt.message}</div>
                            <div className="event-time">{formatTime(evt.timestamp)}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default EventLog;
