const STATES = [
    { key: 'ENTRY', label: 'Entry', num: '1' },
    { key: 'TARE_DONE', label: 'Tare', num: '2' },
    { key: 'DOCK', label: 'Dock', num: '3' },
    { key: 'GROSS_DONE', label: 'Gross', num: '4' },
    { key: 'INVOICE_GENERATED', label: 'Invoice', num: '5' },
    { key: 'EXITED', label: 'Exit', num: '6' },
];

const STATE_ORDER = STATES.map((s) => s.key);

function getStateBadge(state) {
    const map = {
        ENTRY: { cls: 'badge-blue', label: 'Entry' },
        TARE_DONE: { cls: 'badge-amber', label: 'Tare Done' },
        DOCK: { cls: 'badge-amber', label: 'At Dock' },
        GROSS_DONE: { cls: 'badge-green', label: 'Gross Done' },
        INVOICE_GENERATED: { cls: 'badge-red', label: 'Invoice Generated' },
        EXITED: { cls: 'badge-purple', label: 'Exited' },
    };
    return map[state] || { cls: 'badge-blue', label: state };
}

function StatusDisplay({ session }) {
    if (!session) {
        return (
            <div className="card empty-state">
                <div className="empty-state-icon">🚛</div>
                <p>No active session</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Start a truck session to begin monitoring</p>
            </div>
        );
    }

    if (session.state === 'EXITED') {
        return (
            <div className="card completion-card">
                <div className="completion-icon">✅</div>
                <div className="completion-title">Session Complete</div>
                <div className="completion-sub">
                    Truck {session.truckId} has exited the facility.
                    Net weight: {session.grossWeight - session.tareWeight} kg
                </div>
            </div>
        );
    }

    const currentIndex = STATE_ORDER.indexOf(session.state);
    const badge = getStateBadge(session.state);

    return (
        <div className="card status-card">
            <div className="card-title">📊 Session Status</div>

            {/* Progression Bar */}
            <div className="progression-bar">
                {STATES.map((step, i) => {
                    const isCompleted = i < currentIndex;
                    const isActive = i === currentIndex;
                    const cls = isCompleted ? 'completed' : isActive ? 'active' : '';

                    return (
                        <div key={step.key} style={{ display: 'contents' }}>
                            {i > 0 && (
                                <div className={`progression-connector ${isCompleted ? 'filled' : ''}`} />
                            )}
                            <div className={`progression-step ${cls}`}>
                                <div className="progression-dot">
                                    {isCompleted ? '✓' : step.num}
                                </div>
                                <div className="progression-label">{step.label}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Current State Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className={`badge ${badge.cls}`}>{badge.label}</span>
                {session.movementLock && (
                    <span className="badge badge-red">🔒 Movement Locked</span>
                )}
            </div>

            {/* Stats */}
            <div className="status-row">
                <div className="stat-block">
                    <div className="stat-label">Truck ID</div>
                    <div className="stat-value">{session.truckId}</div>
                </div>
                <div className="stat-block">
                    <div className="stat-label">Dock Visits</div>
                    <div className="stat-value">{session.visitCount}</div>
                </div>
            </div>

            <div className="status-row">
                <div className="stat-block">
                    <div className="stat-label">Tare Weight</div>
                    <div className="stat-value">
                        {session.tareWeight != null ? `${session.tareWeight} kg` : '—'}
                    </div>
                </div>
                <div className="stat-block">
                    <div className="stat-label">Gross Weight</div>
                    <div className="stat-value">
                        {session.grossWeight != null ? `${session.grossWeight} kg` : '—'}
                    </div>
                </div>
                {session.tareWeight != null && session.grossWeight != null && (
                    <div className="stat-block">
                        <div className="stat-label">Net Weight</div>
                        <div className="stat-value" style={{ color: 'var(--green)' }}>
                            {session.grossWeight - session.tareWeight} kg
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StatusDisplay;
