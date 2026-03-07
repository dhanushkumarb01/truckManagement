/**
 * TransitionLogsPanel - Displays zone transition and lifecycle movement logs
 * 
 * Shows:
 * - Zone entry logs
 * - Zone exit logs
 * - Lifecycle stage changes
 * - Timestamped event records
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

// Default color palette for zones
const DEFAULT_ZONE_COLORS = {
    'ENTRY_GATE': '#22c55e',
    'EXIT_GATE': '#ef4444',
    'WEIGHBRIDGE': '#f59e0b',
    'DOCK': '#3b82f6',
    'PARKING': '#8b5cf6',
    'RESTRICTED': '#dc2626',
    'LOADING': '#0891b2',
    'UNLOADING': '#059669',
    'INSPECTION': '#7c3aed',
    'OUTSIDE': '#6b7280',
    'ZONE_A': '#f59e0b',
    'ZONE_B': '#3b82f6',
    'ZONE_C': '#22c55e',
    'ZONE_D': '#a855f7',
};

// Get color for a zone
function getZoneColor(zoneName) {
    return DEFAULT_ZONE_COLORS[zoneName] || '#6b7280';
}

// Format zone name for display
function formatZoneName(zoneName) {
    if (!zoneName) return 'UNKNOWN';
    if (zoneName === 'OUTSIDE') return 'OUT';
    if (zoneName.startsWith('ZONE_')) return zoneName.replace('ZONE_', '');
    return zoneName.length > 10 ? zoneName.substring(0, 10) + '...' : zoneName;
}

// Lifecycle stage colors
const LIFECYCLE_COLORS = {
    'ENTRY': '#22c55e',
    'TARE_DONE': '#f59e0b',
    'DOCK': '#3b82f6',
    'GROSS_DONE': '#8b5cf6',
    'INVOICE_GENERATED': '#06b6d4',
    'EXITED': '#6b7280',
};

function TransitionLogsPanel({ localAlerts = [], onClearLocalAlerts }) {
    const [activeTab, setActiveTab] = useState('zone'); // 'zone' | 'lifecycle'
    const [zoneTransitions, setZoneTransitions] = useState([]);
    const [lifecycleEvents, setLifecycleEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch zone transitions from backend
    const fetchZoneTransitions = useCallback(async () => {
        try {
            const res = await api.getAlerts({ type: 'zone_transition', limit: 50 });
            if (res.success && Array.isArray(res.data)) {
                setZoneTransitions(res.data);
            }
        } catch (err) {
            console.error('Failed to fetch zone transitions:', err);
        }
    }, []);

    // Fetch lifecycle events from backend
    const fetchLifecycleEvents = useCallback(async () => {
        try {
            const res = await api.getEvents();
            if (res.success && Array.isArray(res.data)) {
                // Filter to lifecycle-related events
                const lifecycle = res.data.filter(e => 
                    e.eventType === 'LIFECYCLE_CHANGE' || 
                    e.eventType === 'SESSION_START' ||
                    e.eventType === 'SESSION_END'
                );
                setLifecycleEvents(lifecycle.slice(0, 50));
            }
        } catch (err) {
            console.error('Failed to fetch lifecycle events:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        setLoading(true);
        Promise.all([fetchZoneTransitions(), fetchLifecycleEvents()])
            .finally(() => setLoading(false));
    }, [fetchZoneTransitions, fetchLifecycleEvents]);

    // Combine local alerts with backend data for zone transitions
    const allZoneAlerts = [...localAlerts, ...zoneTransitions].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    return (
        <div className="card transition-logs-panel">
            <div className="card-title">📋 Transition Logs</div>
            
            {/* Tab Selector */}
            <div className="logs-tabs" style={{ 
                display: 'flex', 
                gap: '8px', 
                marginBottom: '12px' 
            }}>
                <button
                    className={`btn btn-sm ${activeTab === 'zone' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('zone')}
                >
                    🗺️ Zone Transitions
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'lifecycle' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('lifecycle')}
                >
                    🔄 Lifecycle Events
                </button>
            </div>

            {error && (
                <div className="error-message" style={{
                    color: '#ef4444',
                    padding: '8px',
                    marginBottom: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '4px',
                    fontSize: '12px'
                }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                    Loading logs...
                </div>
            ) : (
                <>
                    {/* Zone Transitions Tab */}
                    {activeTab === 'zone' && (
                        <div className="zone-transitions-list">
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '8px'
                            }}>
                                <span className="alert-count" style={{ fontSize: '12px', color: '#9ca3af' }}>
                                    {allZoneAlerts.length} transition{allZoneAlerts.length !== 1 ? 's' : ''}
                                </span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    {allZoneAlerts.length > 0 && (
                                        <button 
                                            className="btn btn-sm btn-secondary"
                                            onClick={async () => {
                                                if (window.confirm('Permanently delete all zone transition logs? This cannot be undone.')) {
                                                    const res = await api.deleteZoneTransitions();
                                                    if (res.success) {
                                                        setZoneTransitions([]);
                                                        if (onClearLocalAlerts) {
                                                            onClearLocalAlerts();
                                                        }
                                                    }
                                                }
                                            }}
                                        >
                                            Clear Logs
                                        </button>
                                    )}
                                    {localAlerts.length > 0 && onClearLocalAlerts && (
                                        <button 
                                            className="btn btn-sm btn-secondary"
                                            onClick={onClearLocalAlerts}
                                        >
                                            Clear Local
                                        </button>
                                    )}
                                </div>
                            </div>

                            {allZoneAlerts.length === 0 ? (
                                <div className="no-alerts" style={{
                                    textAlign: 'center',
                                    padding: '30px 20px',
                                    color: '#6b7280'
                                }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
                                    <div>Monitoring zone transitions...</div>
                                    <div style={{ fontSize: '11px', marginTop: '4px' }}>
                                        Logs appear when trucks move between zones
                                    </div>
                                </div>
                            ) : (
                                <div className="alert-list" style={{ 
                                    maxHeight: '400px', 
                                    overflowY: 'auto' 
                                }}>
                                    {allZoneAlerts.map((alert, idx) => (
                                        <div 
                                            key={alert.id || alert._id || idx} 
                                            className="alert-item"
                                            style={{
                                                padding: '10px 12px',
                                                marginBottom: '6px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '6px',
                                                borderLeft: '3px solid #3b82f6'
                                            }}
                                        >
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '4px'
                                            }}>
                                                <span style={{ fontWeight: '500' }}>
                                                    🚛 {alert.truckId}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    color: '#6b7280' 
                                                }}>
                                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '8px' 
                                            }}>
                                                <span 
                                                    style={{ 
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '500',
                                                        background: getZoneColor(alert.fromZone),
                                                        color: '#fff',
                                                        opacity: 0.8
                                                    }}
                                                >
                                                    {formatZoneName(alert.fromZone)}
                                                </span>
                                                <span style={{ color: '#6b7280' }}>→</span>
                                                <span 
                                                    style={{ 
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '500',
                                                        background: getZoneColor(alert.toZone),
                                                        color: '#fff'
                                                    }}
                                                >
                                                    {formatZoneName(alert.toZone)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Lifecycle Events Tab */}
                    {activeTab === 'lifecycle' && (
                        <div className="lifecycle-events-list">
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginBottom: '8px'
                            }}>
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                    {lifecycleEvents.length} event{lifecycleEvents.length !== 1 ? 's' : ''}
                                </span>
                                {lifecycleEvents.length > 0 && (
                                    <button 
                                        className="btn btn-sm btn-secondary"
                                        onClick={async () => {
                                            if (window.confirm('Permanently delete all event logs? This cannot be undone.')) {
                                                const res = await api.deleteAllEvents();
                                                if (res.success) {
                                                    setLifecycleEvents([]);
                                                }
                                            }
                                        }}
                                    >
                                        Clear Logs
                                    </button>
                                )}
                            </div>

                            {lifecycleEvents.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '30px 20px',
                                    color: '#6b7280'
                                }}>
                                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                                    <div>No lifecycle events recorded</div>
                                </div>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {lifecycleEvents.map((event, idx) => (
                                        <div 
                                            key={event._id || idx}
                                            style={{
                                                padding: '10px 12px',
                                                marginBottom: '6px',
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '6px',
                                                borderLeft: `3px solid ${LIFECYCLE_COLORS[event.newState] || '#6b7280'}`
                                            }}
                                        >
                                            <div style={{ 
                                                display: 'flex', 
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '4px'
                                            }}>
                                                <span style={{ fontWeight: '500' }}>
                                                    🚛 {event.truckId}
                                                </span>
                                                <span style={{ 
                                                    fontSize: '11px', 
                                                    color: '#6b7280' 
                                                }}>
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                                                {event.eventType}: {event.previousState || 'N/A'} → {event.newState}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Refresh Button */}
            <button
                className="btn btn-secondary"
                onClick={() => {
                    setLoading(true);
                    Promise.all([fetchZoneTransitions(), fetchLifecycleEvents()])
                        .finally(() => setLoading(false));
                }}
                disabled={loading}
                style={{ width: '100%', marginTop: '12px' }}
            >
                🔄 Refresh Logs
            </button>
        </div>
    );
}

export default TransitionLogsPanel;
