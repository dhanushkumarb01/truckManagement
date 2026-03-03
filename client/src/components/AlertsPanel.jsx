/**
 * AlertsPanel - Proximity & Anomaly Alerts Dashboard
 * 
 * Displays:
 * - Real-time proximity violation alerts (BLE)
 * - GPS anomaly alerts (speed, teleport, etc.)
 * - Alert counts and statistics
 * - Acknowledge functionality
 */

import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

// Severity colors
const SEVERITY_COLORS = {
    LOW: '#22c55e',
    MEDIUM: '#f59e0b',
    HIGH: '#ef4444',
    CRITICAL: '#dc2626',
};

// Alert type icons
const ALERT_ICONS = {
    // Proximity
    WEAK_SIGNAL: '📡',
    SIGNAL_LOST: '📴',
    BEACON_MISMATCH: '⚠️',
    UNEXPECTED_ZONE: '🔶',
    DWELL_EXCEEDED: '⏰',
    // Anomaly
    SPEED_VIOLATION: '🏎️',
    TELEPORT: '🌀',
    OUT_OF_BOUNDS: '🚫',
    ACCURACY_POOR: '📍',
    TIMESTAMP_ANOMALY: '🕐',
    DUPLICATE_LOCATION: '📌',
    STATIONARY_TIMEOUT: '⏸️',
};

// Format alert type for display
function formatAlertType(type) {
    return type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Format time ago
function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
}

function AlertsPanel({ autoRefresh = true, refreshInterval = 30000 }) {
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'proximity' | 'anomalies'
    const [alerts, setAlerts] = useState([]);
    const [counts, setCounts] = useState({ proximity: 0, anomaly: 0, total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch alerts
    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            let res;
            
            if (activeTab === 'all') {
                res = await api.getDashboardAlerts(50);
                if (res.success) {
                    setAlerts(res.data.alerts);
                    setCounts(res.data.counts);
                }
            } else if (activeTab === 'proximity') {
                res = await api.getProximityAlerts({ limit: 50, unacknowledged: true });
                if (res.success) {
                    setAlerts(res.data.map(a => ({ ...a, alertCategory: 'PROXIMITY' })));
                }
            } else {
                res = await api.getAnomalyAlerts({ limit: 50, unresolved: true });
                if (res.success) {
                    setAlerts(res.data.map(a => ({ ...a, alertCategory: 'ANOMALY' })));
                }
            }

            if (!res.success) {
                setError(res.message);
            }
        } catch (err) {
            setError('Failed to fetch alerts');
        }

        setLoading(false);
    }, [activeTab]);

    // Initial load and tab change
    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(fetchAlerts, refreshInterval);
        return () => clearInterval(interval);
    }, [autoRefresh, refreshInterval, fetchAlerts]);

    // Acknowledge alert
    const handleAcknowledge = useCallback(async (alert) => {
        const acknowledgeFunc = alert.alertCategory === 'PROXIMITY'
            ? api.acknowledgeProximityAlert
            : api.acknowledgeAnomalyAlert;

        const res = await acknowledgeFunc(alert._id, { acknowledgedBy: 'operator' });
        
        if (res.success) {
            // Remove from list
            setAlerts(prev => prev.filter(a => a._id !== alert._id));
            setCounts(prev => ({
                ...prev,
                [alert.alertCategory.toLowerCase()]: prev[alert.alertCategory.toLowerCase()] - 1,
                total: prev.total - 1,
            }));
        }
    }, []);

    return (
        <div className="card alerts-panel">
            <div className="card-title">
                🚨 Alerts
                <span className="alert-badge" style={{
                    marginLeft: '8px',
                    padding: '2px 8px',
                    background: counts.total > 0 ? '#ef4444' : '#22c55e',
                    borderRadius: '12px',
                    fontSize: '12px',
                }}>
                    {counts.total}
                </span>
            </div>

            {/* Tabs */}
            <div className="alert-tabs" style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '12px',
            }}>
                <button
                    className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('all')}
                >
                    All ({counts.total})
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'proximity' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('proximity')}
                >
                    📡 BLE ({counts.proximity})
                </button>
                <button
                    className={`btn btn-sm ${activeTab === 'anomalies' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('anomalies')}
                >
                    ⚠️ GPS ({counts.anomaly})
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    color: '#ef4444',
                    padding: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    fontSize: '12px',
                }}>
                    {error}
                </div>
            )}

            {/* Alerts List */}
            <div className="alerts-list" style={{
                maxHeight: '400px',
                overflowY: 'auto',
            }}>
                {loading && alerts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af' }}>
                        Loading alerts...
                    </div>
                ) : alerts.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#9ca3af',
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                        <div>No active alerts</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                            System is operating normally
                        </div>
                    </div>
                ) : (
                    alerts.map(alert => (
                        <div
                            key={alert._id}
                            className="alert-item"
                            style={{
                                padding: '12px',
                                marginBottom: '8px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '6px',
                                borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity] || '#6b7280'}`,
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '8px',
                            }}>
                                <div>
                                    <span style={{ fontSize: '16px', marginRight: '6px' }}>
                                        {ALERT_ICONS[alert.violationType || alert.anomalyType] || '⚠️'}
                                    </span>
                                    <span style={{ fontWeight: '600' }}>
                                        {formatAlertType(alert.violationType || alert.anomalyType)}
                                    </span>
                                    <span style={{
                                        marginLeft: '8px',
                                        padding: '2px 6px',
                                        background: SEVERITY_COLORS[alert.severity] || '#6b7280',
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        fontWeight: '600',
                                    }}>
                                        {alert.severity}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                    {timeAgo(alert.timestamp)}
                                </span>
                            </div>

                            {/* Details */}
                            <div style={{
                                fontSize: '12px',
                                color: '#d1d5db',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '4px',
                            }}>
                                <div>🚛 {alert.truckId?.substring(0, 8)}...</div>
                                {alert.currentZone && (
                                    <div>📍 {alert.currentZone}</div>
                                )}
                                {alert.calculatedSpeed && (
                                    <div>🏎️ {alert.calculatedSpeed.toFixed(1)} km/h</div>
                                )}
                                {alert.distance && (
                                    <div>📏 {alert.distance.toFixed(1)}m</div>
                                )}
                                {alert.bleSignalStrength && (
                                    <div>📶 {alert.bleSignalStrength} dBm</div>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{
                                marginTop: '8px',
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}>
                                <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => handleAcknowledge(alert)}
                                    style={{ fontSize: '11px' }}
                                >
                                    ✓ Acknowledge
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Refresh Button */}
            <div style={{
                marginTop: '12px',
                display: 'flex',
                justifyContent: 'center',
            }}>
                <button
                    className="btn btn-sm btn-secondary"
                    onClick={fetchAlerts}
                    disabled={loading}
                >
                    {loading ? '⏳ Loading...' : '🔄 Refresh'}
                </button>
            </div>
        </div>
    );
}

export default AlertsPanel;
