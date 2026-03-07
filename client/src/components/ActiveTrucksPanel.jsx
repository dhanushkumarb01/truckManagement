/**
 * ActiveTrucksPanel - Active Trucks Management Panel
 * 
 * Displays all active trucks with:
 * - Truck ID
 * - Vehicle number
 * - Current lifecycle stage
 * - Current zone
 * - Status
 * - Last update timestamp
 * 
 * Clicking a truck opens detailed view with:
 * - Full lifecycle stages
 * - Zone transition history
 * - Event logs
 * - Alerts associated with that truck
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

// Lifecycle stage configuration
const LIFECYCLE_STAGES = [
    { key: 'ENTRY', label: 'Entry', icon: '🚪', color: '#22c55e' },
    { key: 'TARE_DONE', label: 'Tare Weight', icon: '⚖️', color: '#f59e0b' },
    { key: 'DOCK', label: 'Dock Visit', icon: '🏭', color: '#3b82f6' },
    { key: 'GROSS_DONE', label: 'Gross Weight', icon: '⚖️', color: '#8b5cf6' },
    { key: 'INVOICE_GENERATED', label: 'Invoice', icon: '📄', color: '#06b6d4' },
    { key: 'EXITED', label: 'Exit', icon: '🚪', color: '#6b7280' },
];

// Alert type colors
const ALERT_COLORS = {
    'SPEED_VIOLATION': '#ef4444',
    'UNEXPECTED_ZONE_JUMP': '#f59e0b',
    'GPS_ANOMALY': '#8b5cf6',
    'LIFECYCLE_INCONSISTENCY': '#ec4899',
    'ZONE_DWELL_EXCEEDED': '#f97316',
    'DEFAULT': '#6b7280',
};

function ActiveTrucksPanel({ truckLocations = {}, sessions = [], onSelectTruck }) {
    const [selectedTruck, setSelectedTruck] = useState(null);
    const [truckDetails, setTruckDetails] = useState(null);
    const [truckAlerts, setTruckAlerts] = useState([]);
    const [truckEvents, setTruckEvents] = useState([]);
    const [loading, setLoading] = useState(false);

    // Filter active sessions (not EXITED)
    const activeSessions = sessions.filter(s => s.state !== 'EXITED');

    // Fetch truck details when selected
    const fetchTruckDetails = useCallback(async (truckId) => {
        setLoading(true);
        
        try {
            // Fetch events for this truck
            const eventsRes = await api.getEvents(truckId);
            if (eventsRes.success && Array.isArray(eventsRes.data)) {
                setTruckEvents(eventsRes.data.slice(0, 20));
            }

            // Fetch alerts for this truck (if API supports it)
            try {
                const alertsRes = await api.getAlerts({ truckId, limit: 10 });
                if (alertsRes.success && Array.isArray(alertsRes.data)) {
                    setTruckAlerts(alertsRes.data);
                }
            } catch {
                setTruckAlerts([]);
            }
        } catch (err) {
            console.error('Failed to fetch truck details:', err);
        }
        
        setLoading(false);
    }, []);

    // Handle truck selection
    const handleSelectTruck = useCallback((session) => {
        setSelectedTruck(session);
        setTruckDetails(session);
        fetchTruckDetails(session.truckId);
        
        // Also trigger map selection if callback provided
        if (onSelectTruck) {
            onSelectTruck(session.truckId);
        }
    }, [fetchTruckDetails, onSelectTruck]);

    // Close detail view
    const handleCloseDetails = () => {
        setSelectedTruck(null);
        setTruckDetails(null);
        setTruckAlerts([]);
        setTruckEvents([]);
    };

    // Get lifecycle stage index
    const getStageIndex = (state) => {
        return LIFECYCLE_STAGES.findIndex(s => s.key === state);
    };

    // Get stage color
    const getStageColor = (state) => {
        const stage = LIFECYCLE_STAGES.find(s => s.key === state);
        return stage?.color || '#6b7280';
    };

    return (
        <div className="card active-trucks-panel">
            {!selectedTruck ? (
                // Truck List View
                <>
                    <div className="card-title">🚛 Active Trucks</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                        {activeSessions.length} active truck{activeSessions.length !== 1 ? 's' : ''} in yard
                    </div>

                    {/* Trucks List */}
                    <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                        {activeSessions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 20px', color: '#6b7280' }}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚛</div>
                                <div>No active trucks</div>
                                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                    Trucks appear when sessions are started
                                </div>
                            </div>
                        ) : (
                            activeSessions.map((session) => {
                                const location = truckLocations[session.truckId];
                                const stageColor = getStageColor(session.state);
                                
                                return (
                                    <div 
                                        key={session._id || session.truckId}
                                        onClick={() => handleSelectTruck(session)}
                                        style={{
                                            padding: '12px',
                                            marginBottom: '8px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '8px',
                                            borderLeft: `3px solid ${stageColor}`,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                    >
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginBottom: '6px'
                                        }}>
                                            <span style={{ fontWeight: '600', fontSize: '14px' }}>
                                                🚛 {session.truckId}
                                            </span>
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '10px',
                                                fontWeight: '500',
                                                background: stageColor,
                                                color: '#fff'
                                            }}>
                                                {session.state}
                                            </span>
                                        </div>
                                        
                                        <div style={{ 
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '4px',
                                            fontSize: '11px', 
                                            color: '#9ca3af' 
                                        }}>
                                            {session.tareWeight && (
                                                <div>⚖️ Tare: {session.tareWeight} kg</div>
                                            )}
                                            {session.grossWeight && (
                                                <div>⚖️ Gross: {session.grossWeight} kg</div>
                                            )}
                                            {location && (
                                                <div>📍 GPS Active</div>
                                            )}
                                        </div>
                                        
                                        <div style={{ 
                                            marginTop: '6px', 
                                            fontSize: '10px', 
                                            color: '#6b7280' 
                                        }}>
                                            Updated: {new Date(session.updatedAt || session.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Summary Stats */}
                    <div style={{ 
                        marginTop: '12px',
                        padding: '10px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '6px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '4px',
                        textAlign: 'center',
                        fontSize: '10px'
                    }}>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#22c55e' }}>
                                {activeSessions.filter(s => s.state === 'ENTRY').length}
                            </div>
                            <div style={{ color: '#6b7280' }}>Entry</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#f59e0b' }}>
                                {activeSessions.filter(s => s.state === 'TARE_DONE').length}
                            </div>
                            <div style={{ color: '#6b7280' }}>Tare</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#3b82f6' }}>
                                {activeSessions.filter(s => s.state === 'DOCK').length}
                            </div>
                            <div style={{ color: '#6b7280' }}>Dock</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#8b5cf6' }}>
                                {activeSessions.filter(s => ['GROSS_DONE', 'INVOICE_GENERATED'].includes(s.state)).length}
                            </div>
                            <div style={{ color: '#6b7280' }}>Ready</div>
                        </div>
                    </div>
                </>
            ) : (
                // Truck Detail View
                <>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: '12px'
                    }}>
                        <button 
                            onClick={handleCloseDetails}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                fontSize: '14px'
                            }}
                        >
                            ← Back
                        </button>
                        <span style={{ fontWeight: '600' }}>
                            🚛 {selectedTruck.truckId}
                        </span>
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '500',
                            background: getStageColor(selectedTruck.state),
                            color: '#fff'
                        }}>
                            {selectedTruck.state}
                        </span>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                            Loading details...
                        </div>
                    ) : (
                        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            {/* Lifecycle Progress */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                                    Lifecycle Progress
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {LIFECYCLE_STAGES.map((stage, idx) => {
                                        const currentIdx = getStageIndex(selectedTruck.state);
                                        const isComplete = idx <= currentIdx;
                                        const isCurrent = idx === currentIdx;
                                        
                                        return (
                                            <div 
                                                key={stage.key}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '8px 12px',
                                                    background: isCurrent ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)',
                                                    borderRadius: '6px',
                                                    borderLeft: `3px solid ${isComplete ? stage.color : '#374151'}`,
                                                    opacity: isComplete ? 1 : 0.5
                                                }}
                                            >
                                                <span style={{ fontSize: '16px' }}>{stage.icon}</span>
                                                <span style={{ 
                                                    flex: 1,
                                                    fontWeight: isCurrent ? '600' : '400',
                                                    color: isComplete ? '#fff' : '#6b7280'
                                                }}>
                                                    {stage.label}
                                                </span>
                                                {isComplete && !isCurrent && (
                                                    <span style={{ color: '#22c55e' }}>✓</span>
                                                )}
                                                {isCurrent && (
                                                    <span style={{ 
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        fontSize: '9px',
                                                        background: '#3b82f6',
                                                        color: '#fff'
                                                    }}>
                                                        CURRENT
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Weights */}
                            {(selectedTruck.tareWeight || selectedTruck.grossWeight) && (
                                <div style={{
                                    background: 'rgba(59,130,246,0.1)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                                        Weight Information
                                    </div>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gap: '8px',
                                        textAlign: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>Tare</div>
                                            <div style={{ fontWeight: '600', fontSize: '16px' }}>
                                                {selectedTruck.tareWeight || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>Gross</div>
                                            <div style={{ fontWeight: '600', fontSize: '16px' }}>
                                                {selectedTruck.grossWeight || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#6b7280' }}>Net</div>
                                            <div style={{ fontWeight: '600', fontSize: '16px', color: '#22c55e' }}>
                                                {selectedTruck.tareWeight && selectedTruck.grossWeight 
                                                    ? selectedTruck.grossWeight - selectedTruck.tareWeight 
                                                    : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Alerts Section */}
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ 
                                    fontSize: '12px', 
                                    color: '#9ca3af', 
                                    marginBottom: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between'
                                }}>
                                    <span>Alerts</span>
                                    <span style={{ 
                                        color: truckAlerts.length > 0 ? '#ef4444' : '#6b7280' 
                                    }}>
                                        {truckAlerts.length}
                                    </span>
                                </div>
                                
                                {truckAlerts.length === 0 ? (
                                    <div style={{
                                        padding: '12px',
                                        background: 'rgba(34,197,94,0.1)',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        fontSize: '12px',
                                        color: '#22c55e'
                                    }}>
                                        ✓ No alerts for this truck
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {truckAlerts.map((alert, idx) => (
                                            <div 
                                                key={alert._id || idx}
                                                style={{
                                                    padding: '10px 12px',
                                                    background: 'rgba(239,68,68,0.1)',
                                                    borderRadius: '6px',
                                                    borderLeft: `3px solid ${ALERT_COLORS[alert.type] || ALERT_COLORS.DEFAULT}`,
                                                    fontSize: '12px'
                                                }}
                                            >
                                                <div style={{ 
                                                    display: 'flex', 
                                                    justifyContent: 'space-between',
                                                    marginBottom: '4px'
                                                }}>
                                                    <span style={{ fontWeight: '500', color: '#ef4444' }}>
                                                        ⚠️ {alert.type?.replace(/_/g, ' ') || 'Alert'}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: '#6b7280' }}>
                                                        {new Date(alert.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div style={{ color: '#9ca3af' }}>
                                                    {alert.message || alert.description || 'No details'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Events */}
                            <div>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '8px' }}>
                                    Recent Events ({truckEvents.length})
                                </div>
                                
                                {truckEvents.length === 0 ? (
                                    <div style={{
                                        padding: '12px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        fontSize: '12px',
                                        color: '#6b7280'
                                    }}>
                                        No events recorded
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {truckEvents.slice(0, 5).map((event, idx) => (
                                            <div 
                                                key={event._id || idx}
                                                style={{
                                                    padding: '8px 10px',
                                                    background: 'rgba(255,255,255,0.02)',
                                                    borderRadius: '4px',
                                                    fontSize: '11px',
                                                    display: 'flex',
                                                    justifyContent: 'space-between'
                                                }}
                                            >
                                                <span style={{ color: '#9ca3af' }}>
                                                    {event.eventType || event.type || 'Event'}
                                                </span>
                                                <span style={{ color: '#6b7280' }}>
                                                    {new Date(event.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default ActiveTrucksPanel;
