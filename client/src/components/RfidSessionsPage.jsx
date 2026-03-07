/**
 * RfidSessionsPage.jsx
 * 
 * Full-page RFID Sessions view for top navigation.
 * Shows QR linking sessions for drivers with expiration.
 * 
 * Features:
 * - Sessions table with FastTag ID, Session ID, Truck ID
 * - QR code modal with expiration countdown
 * - Session status: Waiting / Active / Expired
 * - Auto-refresh every 10 seconds
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../api';
import './RfidSessionsPage.css';

// QR expiration time in minutes
const QR_EXPIRATION_MINUTES = 15;

// Session status config
const SESSION_STATUS = {
    'WAITING': { label: 'Waiting for Driver', color: '#f59e0b', icon: '⏳' },
    'ACTIVE': { label: 'Active', color: '#22c55e', icon: '✅' },
    'EXPIRED': { label: 'Expired', color: '#ef4444', icon: '❌' },
    'ENTERED': { label: 'Entry Complete', color: '#3b82f6', icon: '🚪' },
    'TARE_DONE': { label: 'Tare Recorded', color: '#8b5cf6', icon: '⚖️' },
    'DOCKED': { label: 'At Loading Dock', color: '#06b6d4', icon: '🏗️' },
    'GROSS_DONE': { label: 'Gross Recorded', color: '#10b981', icon: '📦' },
    'INVOICED': { label: 'Invoice Generated', color: '#0ea5e9', icon: '🧾' },
    'EXITED': { label: 'Exited', color: '#6b7280', icon: '🚛' },
};

function RfidSessionsPage() {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [qrTimeLeft, setQrTimeLeft] = useState(null);
    const timerRef = useRef(null);

    // Fetch sessions
    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.getAllSessions();
            if (res.success && Array.isArray(res.data)) {
                // Sort by creation date (newest first)
                const sorted = res.data.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setSessions(sorted);
                setError(null);
            } else {
                setError(res.message || 'Failed to fetch sessions');
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
            setError('Failed to connect to backend');
        }
        setLoading(false);
    }, []);

    // Initial fetch and polling
    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 10000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    // Calculate QR expiration
    const calculateTimeLeft = useCallback((createdAt) => {
        const created = new Date(createdAt).getTime();
        const expiresAt = created + (QR_EXPIRATION_MINUTES * 60 * 1000);
        const now = Date.now();
        const diff = expiresAt - now;
        
        if (diff <= 0) {
            return { expired: true, minutes: 0, seconds: 0 };
        }
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return { expired: false, minutes, seconds };
    }, []);

    // Start countdown timer for selected session
    useEffect(() => {
        if (showModal && selectedSession) {
            const updateTimer = () => {
                const timeLeft = calculateTimeLeft(selectedSession.createdAt);
                setQrTimeLeft(timeLeft);
            };
            
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
            
            return () => {
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                }
            };
        }
    }, [showModal, selectedSession, calculateTimeLeft]);

    // Get session status
    const getSessionStatus = (session) => {
        // Check if QR expired (for sessions waiting for driver scan)
        if (session.state === 'ENTERED' || !session.driverLinked) {
            const timeLeft = calculateTimeLeft(session.createdAt);
            if (timeLeft.expired) {
                return 'EXPIRED';
            }
            if (!session.driverLinked) {
                return 'WAITING';
            }
        }
        
        return session.state || 'ACTIVE';
    };

    // Open session modal
    const handleViewSession = (session) => {
        setSelectedSession(session);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedSession(null);
        setQrTimeLeft(null);
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
    };

    // Active vs history sessions
    const activeSessions = sessions.filter(s => s.state !== 'EXITED');
    const historySessions = sessions.filter(s => s.state === 'EXITED').slice(0, 10);

    return (
        <div className="rfid-page">
            <div className="rfid-page-header">
                <div className="rfid-page-title">
                    <h1>📡 RFID Sessions</h1>
                    <p>QR linking sessions for driver scanning</p>
                </div>
                <button 
                    className="refresh-btn"
                    onClick={fetchSessions}
                    disabled={loading}
                >
                    {loading ? '⏳' : '🔄'} Refresh
                </button>
            </div>

            {error && (
                <div className="rfid-error">
                    ⚠️ {error}
                </div>
            )}

            {/* Stats Bar */}
            <div className="rfid-stats">
                <div className="stat-item">
                    <span className="stat-value">{activeSessions.length}</span>
                    <span className="stat-label">Active Sessions</span>
                </div>
                <div className="stat-item waiting">
                    <span className="stat-value">
                        {activeSessions.filter(s => getSessionStatus(s) === 'WAITING').length}
                    </span>
                    <span className="stat-label">Awaiting Driver</span>
                </div>
                <div className="stat-item expired">
                    <span className="stat-value">
                        {activeSessions.filter(s => getSessionStatus(s) === 'EXPIRED').length}
                    </span>
                    <span className="stat-label">Expired QR</span>
                </div>
            </div>

            {/* Sessions Table */}
            <div className="rfid-table-container">
                <h2>Active Sessions</h2>
                
                {loading && sessions.length === 0 ? (
                    <div className="rfid-loading">Loading sessions...</div>
                ) : activeSessions.length === 0 ? (
                    <div className="rfid-empty">
                        <div className="empty-icon">📡</div>
                        <p>No active sessions</p>
                        <span>Sessions appear when trucks are scanned at RFID gate</span>
                    </div>
                ) : (
                    <table className="rfid-table">
                        <thead>
                            <tr>
                                <th>Truck ID</th>
                                <th>FastTag ID</th>
                                <th>Session ID</th>
                                <th>Scan Time</th>
                                <th>Status</th>
                                <th>QR Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeSessions.map(session => {
                                const status = getSessionStatus(session);
                                const statusConfig = SESSION_STATUS[status] || SESSION_STATUS['ACTIVE'];
                                const timeLeft = calculateTimeLeft(session.createdAt);
                                
                                return (
                                    <tr key={session._id}>
                                        <td className="truck-id">{session.truckId}</td>
                                        <td className="fastag-id">
                                            {session.fastTagId || '—'}
                                        </td>
                                        <td className="session-id mono">
                                            {session._id?.slice(-8)}
                                        </td>
                                        <td className="scan-time">
                                            {new Date(session.createdAt).toLocaleString()}
                                        </td>
                                        <td>
                                            <span 
                                                className="status-badge"
                                                style={{ background: statusConfig.color }}
                                            >
                                                {statusConfig.icon} {statusConfig.label}
                                            </span>
                                        </td>
                                        <td className="qr-status">
                                            {timeLeft.expired ? (
                                                <span className="qr-expired">❌ Expired</span>
                                            ) : (
                                                <span className="qr-valid">
                                                    ✅ Valid ({timeLeft.minutes}:{timeLeft.seconds.toString().padStart(2, '0')})
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className="view-qr-btn"
                                                onClick={() => handleViewSession(session)}
                                            >
                                                View QR
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Recent History */}
            {historySessions.length > 0 && (
                <div className="rfid-table-container history">
                    <h2>Recent History (Exited)</h2>
                    <table className="rfid-table">
                        <thead>
                            <tr>
                                <th>Truck ID</th>
                                <th>Session ID</th>
                                <th>Entry Time</th>
                                <th>Exit Time</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historySessions.map(session => {
                                const entry = new Date(session.createdAt);
                                const exit = session.exitTime ? new Date(session.exitTime) : new Date();
                                const duration = Math.round((exit - entry) / 60000);
                                
                                return (
                                    <tr key={session._id} className="history-row">
                                        <td className="truck-id">{session.truckId}</td>
                                        <td className="session-id mono">{session._id?.slice(-8)}</td>
                                        <td>{entry.toLocaleString()}</td>
                                        <td>{session.exitTime ? exit.toLocaleString() : '—'}</td>
                                        <td>{duration} min</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* QR Modal */}
            {showModal && selectedSession && (
                <div className="qr-modal-overlay" onClick={closeModal}>
                    <div className="qr-modal" onClick={e => e.stopPropagation()}>
                        <div className="qr-modal-header">
                            <h3>🚛 {selectedSession.truckId}</h3>
                            <button className="close-btn" onClick={closeModal}>✕</button>
                        </div>
                        
                        <div className="qr-modal-body">
                            {/* Session Info */}
                            <div className="qr-session-info">
                                <div className="info-item">
                                    <span className="label">Session ID</span>
                                    <span className="value mono">{selectedSession._id}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">FastTag ID</span>
                                    <span className="value">{selectedSession.fastTagId || 'Not recorded'}</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">Current State</span>
                                    <span className="value">{selectedSession.state}</span>
                                </div>
                            </div>

                            {/* QR Display */}
                            <div className="qr-display">
                                {qrTimeLeft?.expired ? (
                                    <div className="qr-expired-notice">
                                        <div className="expired-icon">❌</div>
                                        <h4>QR Code Expired</h4>
                                        <p>This session requires a new RFID scan</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="qr-code-placeholder">
                                            {/* QR Code would be generated here */}
                                            <div className="qr-code-box">
                                                <div className="qr-text">QR</div>
                                                <div className="qr-sub">
                                                    {selectedSession._id?.slice(-8)}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="qr-timer">
                                            <span className="timer-label">Time Remaining:</span>
                                            <span className={`timer-value ${qrTimeLeft?.minutes < 2 ? 'warning' : ''}`}>
                                                {qrTimeLeft?.minutes}:{qrTimeLeft?.seconds.toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        
                                        <p className="qr-instruction">
                                            Driver should scan this QR to link their device for GPS tracking
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Status */}
                            <div className="qr-status-display">
                                <span className="label">Session Status:</span>
                                {(() => {
                                    const status = getSessionStatus(selectedSession);
                                    const config = SESSION_STATUS[status] || SESSION_STATUS['ACTIVE'];
                                    return (
                                        <span 
                                            className="status-badge large"
                                            style={{ background: config.color }}
                                        >
                                            {config.icon} {config.label}
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RfidSessionsPage;
