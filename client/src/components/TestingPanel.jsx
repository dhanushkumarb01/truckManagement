/**
 * TestingPanel - Displays zone transition alerts
 */
import { ZONE_LABELS, ZONE_COLORS } from '../utils/zoneUtils';

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
                                                background: ZONE_COLORS[alert.fromZone] || '#6b7280',
                                                opacity: 0.8
                                            }}
                                        >
                                            {alert.fromZone === 'OUTSIDE' ? 'OUT' : alert.fromZone.replace('ZONE_', '')}
                                        </span>
                                        <span className="arrow">→</span>
                                        <span 
                                            className="zone-badge"
                                            style={{ 
                                                background: ZONE_COLORS[alert.toZone] || '#6b7280'
                                            }}
                                        >
                                            {alert.toZone === 'OUTSIDE' ? 'OUT' : alert.toZone.replace('ZONE_', '')}
                                        </span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Zone Legend */}
            <div className="zone-legend">
                <div className="legend-title">Zone Map</div>
                <div className="legend-grid">
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: ZONE_COLORS.ZONE_A }}></span>
                        <span>A (Top-Left)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: ZONE_COLORS.ZONE_B }}></span>
                        <span>B (Top-Right)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: ZONE_COLORS.ZONE_D }}></span>
                        <span>D (Bot-Left)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-color" style={{ background: ZONE_COLORS.ZONE_C }}></span>
                        <span>C (Bot-Right)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TestingPanel;
