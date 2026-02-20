import { useState, useCallback } from 'react';

function DockPanel({ session, onDock, loading }) {
    const [shaking, setShaking] = useState(false);
    const [showDetection, setShowDetection] = useState(false);
    const [detectionPhase, setDetectionPhase] = useState(0); // 0=rfid, 1=camera, 2=done

    const state = session?.state;
    const isLocked = session?.movementLock || session?.invoiceStatus === 'GENERATED';
    const canDock = (state === 'TARE_DONE' || state === 'GROSS_DONE') && !isLocked;
    const isVisible = !!session && state !== 'EXITED' && state !== 'ENTRY';

    const simulateDetection = useCallback(() => {
        setShowDetection(true);
        setDetectionPhase(0);

        // Phase 1: RFID scan (800ms)
        setTimeout(() => setDetectionPhase(1), 800);
        // Phase 2: Camera verify (1600ms)
        setTimeout(() => setDetectionPhase(2), 1600);
        // Phase 3: Close and call backend (2200ms)
        setTimeout(() => {
            setShowDetection(false);
            setDetectionPhase(0);
            onDock();
        }, 2200);
    }, [onDock]);

    const handleClick = () => {
        if (loading) return;

        if (isLocked) {
            // Trigger shake + let parent handle violation modal
            setShaking(true);
            setTimeout(() => setShaking(false), 500);
            onDock(); // Parent will get error response and show modal
            return;
        }

        if (canDock) {
            simulateDetection();
        }
    };

    if (!isVisible) return null;

    return (
        <>
            <div className="card">
                <div className="card-title">🏭 Loading Dock</div>

                <div className={isLocked ? 'tooltip-wrapper' : ''}>
                    {isLocked && <span className="tooltip-text">Movement locked — invoice generated</span>}
                    <button
                        className={`btn ${isLocked ? 'btn-locked' : 'btn-warning'} ${shaking ? 'shake' : ''}`}
                        style={{ width: '100%' }}
                        onClick={handleClick}
                        disabled={loading || (!canDock && !isLocked)}
                    >
                        {loading ? <span className="spinner spinner-dark" /> : null}
                        {isLocked ? '🔒 Enter Dock (Locked)' : '📡 Enter Dock'}
                    </button>
                </div>

                {session?.visitCount > 0 && (
                    <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Dock visits: <strong>{session.visitCount}</strong>
                    </div>
                )}
            </div>

            {/* RFID + Camera Detection Overlay */}
            {showDetection && (
                <div className="detection-overlay">
                    <div className="detection-card">
                        {detectionPhase < 2 && (
                            <>
                                {detectionPhase === 0 && (
                                    <>
                                        <div className="rfid-icon">📡</div>
                                        <div className="detection-status">Scanning RFID tag...</div>
                                    </>
                                )}
                                {detectionPhase === 1 && (
                                    <>
                                        <div className="rfid-icon" style={{ animation: 'none' }}>📡</div>
                                        <div className="detection-status">
                                            RFID verified <span className="detection-check">✓</span>
                                        </div>
                                        <div style={{ marginTop: 16 }}>
                                            <div className="camera-icon">📸</div>
                                            <div className="detection-status">Camera verification...</div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                        {detectionPhase === 2 && (
                            <>
                                <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
                                <div className="detection-status" style={{ color: 'var(--green)' }}>
                                    Identity confirmed — Entering dock
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default DockPanel;
