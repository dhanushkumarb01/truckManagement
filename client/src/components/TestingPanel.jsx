/**
 * TestingPanel - Displays zone transition alerts
 * NOTE: Zone detection moved to server-side. This panel now shows
 * alerts from backend ZoneTransition events, not client-side detection.
 */

// Default color palette for zones (used as fallback)
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
    // Legacy zone support
    'ZONE_A': '#f59e0b',
    'ZONE_B': '#3b82f6',
    'ZONE_C': '#22c55e',
    'ZONE_D': '#a855f7',
};

// Get color for a zone (with fallback)
function getZoneColor(zoneName) {
    return DEFAULT_ZONE_COLORS[zoneName] || '#6b7280';
}

// Format zone name for display
function formatZoneName(zoneName) {
    if (!zoneName) return 'UNKNOWN';
    if (zoneName === 'OUTSIDE') return 'OUT';
    // Handle legacy ZONE_A format
    if (zoneName.startsWith('ZONE_')) return zoneName.replace('ZONE_', '');
    // Handle database zone names
    return zoneName.length > 8 ? zoneName.substring(0, 8) : zoneName;
}

function TestingPanel({ alerts, onClearAlerts }) {
    return (
        <div className="card testing-panel">
            <div className="card-title">🧪 Testing Panel</div>
            <div className="testing-subtitle">Zone Transition Alerts</div>
            
            {/* Alert Controls */}
            <div className="testing-controls">
                <span className="alert-count">
                    {alerts.length} transition{alerts.length !== 1 ? 's' : ''}
                </span>
                {alerts.length > 0 && (
                    <button 
                        className="btn btn-sm btn-secondary"
                        onClick={onClearAlerts}
                    >
                        Clear
                    </button>
                )}
            </div>
            
            {/* Alert List */}
            <div className="testing-alerts">
                {alerts.length === 0 ? (
                    <div className="no-alerts">
                        <div className="no-alerts-icon">📡</div>
                        <div className="no-alerts-text">
                            Monitoring zone transitions...
                        </div>
                        <div className="no-alerts-hint">
                            Alerts will appear when trucks move between zones
                        </div>
                    </div>
                ) : (
                    <div className="alert-list">
                        {alerts.slice().reverse().map((alert, idx) => (
                            <div key={alert.id || idx} className="alert-item">
                                <div className="alert-time">
                                    {new Date(alert.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="alert-content">
                                    <span className="alert-truck">🚛 {alert.truckId}</span>
                                    <span className="alert-transition">
                                        <span 
                                            className="zone-badge"
                                            style={{ 
                                                background: getZoneColor(alert.fromZone),
                                                opacity: 0.8
                                            }}
                                        >
                                            {formatZoneName(alert.fromZone)}
                                        </span>
                                        <span className="arrow">→</span>
                                        <span 
                                            className="zone-badge"
                                            style={{ 
                                                background: getZoneColor(alert.toZone)
                                            }}
                                        >
                                            {formatZoneName(alert.toZone)}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Zone Legend - Dynamic zones are managed in Zones tab */}
            <div className="zone-legend">
                <div className="legend-title">Zone Types</div>
                <div className="legend-grid">
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: DEFAULT_ZONE_COLORS.ENTRY_GATE }}></span>
                        <span>Entry</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: DEFAULT_ZONE_COLORS.EXIT_GATE }}></span>
                        <span>Exit</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: DEFAULT_ZONE_COLORS.DOCK }}></span>
                        <span>Dock</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: DEFAULT_ZONE_COLORS.WEIGHBRIDGE }}></span>
                        <span>Weigh</span>
                    </div>
                </div>
                <div className="legend-hint">
                    View all zones in the 🗺️ Zones tab
                </div>
            </div>
        </div>
    );
}

export default TestingPanel;
