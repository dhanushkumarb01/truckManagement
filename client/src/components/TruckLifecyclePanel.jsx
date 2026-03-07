/**
 * TruckLifecyclePanel.jsx
 * 
 * Production-ready Truck Lifecycle page with 3-column layout.
 * Matches the reference UI layout exactly.
 * No manual controls - display only.
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';
import './TruckLifecyclePanel.css';

// Lifecycle stages in order
const STAGES = [
    { key: 'ENTRY', label: 'ENTRY', num: 1 },
    { key: 'TARE_DONE', label: 'TARE', num: 2 },
    { key: 'DOCK', label: 'DOCK', num: 3 },
    { key: 'GROSS_DONE', label: 'GROSS', num: 4 },
    { key: 'INVOICE_GENERATED', label: 'INVOICE', num: 5 },
    { key: 'EXITED', label: 'EXIT', num: 6 },
];

const STATE_ORDER = STAGES.map(s => s.key);

function getStateBadge(state) {
    const map = {
        ENTRY: { cls: 'lc-badge--blue', label: 'Entry' },
        TARE_DONE: { cls: 'lc-badge--amber', label: 'Tare Done' },
        DOCK: { cls: 'lc-badge--amber', label: 'At Dock' },
        GROSS_DONE: { cls: 'lc-badge--green', label: 'Gross Done' },
        INVOICE_GENERATED: { cls: 'lc-badge--green', label: 'Invoice Generated' },
        EXITED: { cls: 'lc-badge--purple', label: 'Exited' },
    };
    return map[state] || { cls: 'lc-badge--blue', label: state };
}

function getEventColor(type) {
    if (type === 'VIOLATION' || type === 'REJECTED') return 'var(--red)';
    if (type === 'INVOICE_GENERATED') return 'var(--purple)';
    if (type === 'DOCK_ENTRY') return 'var(--amber)';
    if (type === 'SESSION_EXIT') return 'var(--text-dim)';
    if (type === 'GROSS_RECORDED') return 'var(--green)';
    if (type === 'TARE_RECORDED') return 'var(--cyan)';
    return 'var(--blue)';
}

function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
}

function TruckLifecyclePanel() {
    const [sessions, setSessions] = useState([]);
    const [selectedTruckId, setSelectedTruckId] = useState('');
    const [session, setSession] = useState(null);
    const [events, setEvents] = useState([]);

    // Fetch all active sessions
    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.getAllSessions();
            if (res.success && Array.isArray(res.data)) {
                const active = res.data.filter(s => s.state !== 'EXITED');
                setSessions(active);
                
                if (!selectedTruckId && active.length > 0) {
                    setSelectedTruckId(active[0].truckId);
                }
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    }, [selectedTruckId]);

    // Fetch details for selected truck
    const fetchTruckDetails = useCallback(async (truckId) => {
        if (!truckId) {
            setSession(null);
            setEvents([]);
            return;
        }
        try {
            const [sessionRes, eventsRes] = await Promise.all([
                api.getSession(truckId),
                api.getEvents(truckId)
            ]);
            if (sessionRes.success) {
                setSession(sessionRes.data);
            }
            if (eventsRes.success && Array.isArray(eventsRes.data)) {
                setEvents(eventsRes.data);
            }
        } catch (err) {
            console.error('Failed to fetch truck details:', err);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 10000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    useEffect(() => {
        if (selectedTruckId) {
            fetchTruckDetails(selectedTruckId);
            const interval = setInterval(() => fetchTruckDetails(selectedTruckId), 5000);
            return () => clearInterval(interval);
        }
    }, [selectedTruckId, fetchTruckDetails]);

    const handleSelect = (e) => {
        setSelectedTruckId(e.target.value);
    };

    const currentIndex = session ? STATE_ORDER.indexOf(session.state) : -1;
    const badge = session ? getStateBadge(session.state) : null;

    return (
        <div className="lifecycle-layout">
            {/* ===== LEFT PANEL — Truck Selector ===== */}
            <div className="lc-panel lc-panel--left">
                <div className="lc-panel__header">
                    <span className="lc-panel__icon">■</span>
                    <span className="lc-panel__title">ACTIVE TRUCKS</span>
                </div>
                <select 
                    className="lc-selector" 
                    value={selectedTruckId} 
                    onChange={handleSelect}
                >
                    {sessions.length === 0 && (
                        <option value="">No active trucks</option>
                    )}
                    {sessions.map(s => (
                        <option key={s.truckId} value={s.truckId}>
                            {s.truckId} — {s.state.replace(/_/g, '_')}
                        </option>
                    ))}
                </select>
            </div>

            {/* ===== CENTER PANEL — Session Status ===== */}
            <div className="lc-panel lc-panel--center">
                <div className="lc-panel__header">
                    <span className="lc-panel__icon">■</span>
                    <span className="lc-panel__title">SESSION STATUS</span>
                </div>

                {session ? (
                    <>
                        {/* Horizontal Lifecycle Progress Tracker */}
                        <div className="lc-progress">
                            {STAGES.map((stage, i) => {
                                const isCompleted = i < currentIndex;
                                const isActive = i === currentIndex;
                                return (
                                    <div key={stage.key} className="lc-progress__step">
                                        <div className={`lc-progress__dot ${isCompleted ? 'lc-progress__dot--completed' : ''} ${isActive ? 'lc-progress__dot--active' : ''}`}>
                                            {isCompleted ? '✓' : stage.num}
                                        </div>
                                        <div className="lc-progress__label">{stage.label}</div>
                                        {i < STAGES.length - 1 && (
                                            <div className={`lc-progress__connector ${isCompleted ? 'lc-progress__connector--filled' : ''}`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Status Badges */}
                        <div className="lc-badges">
                            <span className={`lc-badge ${badge.cls}`}>{badge.label}</span>
                            {session.movementLocked && (
                                <span className="lc-badge lc-badge--amber">■ Movement Locked</span>
                            )}
                        </div>

                        {/* Truck Information Grid */}
                        <div className="lc-stats">
                            {/* Row 1: Truck ID + Dock Visits */}
                            <div className="lc-stats__row lc-stats__row--2col">
                                <div className="lc-stat">
                                    <div className="lc-stat__label">TRUCK ID</div>
                                    <div className="lc-stat__value">{session.truckId}</div>
                                </div>
                                <div className="lc-stat">
                                    <div className="lc-stat__label">DOCK VISITS</div>
                                    <div className="lc-stat__value">{session.dockVisits || 0}</div>
                                </div>
                            </div>
                            {/* Row 2: Weights */}
                            <div className="lc-stats__row lc-stats__row--3col">
                                <div className="lc-stat">
                                    <div className="lc-stat__label">TARE WEIGHT</div>
                                    <div className="lc-stat__value">
                                        {session.tareWeight != null ? `${session.tareWeight} kg` : '—'}
                                    </div>
                                </div>
                                <div className="lc-stat">
                                    <div className="lc-stat__label">GROSS WEIGHT</div>
                                    <div className="lc-stat__value">
                                        {session.grossWeight != null ? `${session.grossWeight} kg` : '—'}
                                    </div>
                                </div>
                                <div className="lc-stat lc-stat--highlight">
                                    <div className="lc-stat__label">NET WEIGHT</div>
                                    <div className="lc-stat__value lc-stat__value--cyan">
                                        {session.tareWeight != null && session.grossWeight != null
                                            ? `${session.grossWeight - session.tareWeight} kg`
                                            : '—'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="lc-empty">
                        <p>Select a truck to view lifecycle status</p>
                    </div>
                )}
            </div>

            {/* ===== RIGHT PANEL — Event Log ===== */}
            <div className="lc-panel lc-panel--right">
                <div className="lc-panel__header">
                    <span className="lc-panel__icon">■</span>
                    <span className="lc-panel__title">EVENT LOG</span>
                </div>
                
                <div className="lc-events">
                    {events.length === 0 ? (
                        <div className="lc-empty">No events recorded</div>
                    ) : (
                        events.slice(0, 20).map((event, idx) => {
                            const eventType = event.eventType || event.type || 'EVENT';
                            return (
                                <div key={idx} className="lc-event">
                                    <div 
                                        className="lc-event__type"
                                        style={{ color: getEventColor(eventType) }}
                                    >
                                        {eventType.replace(/_/g, '_')}
                                    </div>
                                    {event.details && (
                                        <div className="lc-event__details">{event.details}</div>
                                    )}
                                    <div className="lc-event__time">{formatTime(event.timestamp)}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

export default TruckLifecyclePanel;
