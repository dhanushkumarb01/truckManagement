import { useMemo } from 'react';

const STATE_BADGE = {
    ENTRY: 'badge-blue',
    TARE_DONE: 'badge-amber',
    DOCK: 'badge-amber',
    GROSS_DONE: 'badge-green',
    INVOICE_GENERATED: 'badge-red',
    EXITED: 'badge-purple',
};

function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * TruckListPanel - Shows list of trucks with their latest GPS locations
 * @param {Object} props
 * @param {Object} props.truckLocations - Dictionary of truckId -> latest location data
 * @param {Array} props.sessions - Array of truck sessions for status info
 * @param {string} props.selectedTruckId - Currently selected truck ID
 * @param {Function} props.onSelectTruck - Callback when a truck is clicked
 */
function TruckListPanel({ truckLocations, sessions, selectedTruckId, onSelectTruck }) {
    // Create a merged view of trucks combining GPS locations and session info
    const trucks = useMemo(() => {
        const sessionMap = {};
        sessions.forEach(s => {
            sessionMap[s.truckId] = s;
        });

        // Get all unique truck IDs from both sources
        const allTruckIds = new Set([
            ...Object.keys(truckLocations),
            ...sessions.map(s => s.truckId)
        ]);

        return Array.from(allTruckIds).map(truckId => {
            const location = truckLocations[truckId];
            const session = sessionMap[truckId];
            
            return {
                truckId,
                latitude: location?.latitude,
                longitude: location?.longitude,
                lastUpdated: location?.timestamp || session?.updatedAt,
                state: session?.state || 'UNKNOWN',
                hasLocation: !!location
            };
        }).sort((a, b) => {
            // Sort by last updated, most recent first
            const timeA = new Date(a.lastUpdated || 0).getTime();
            const timeB = new Date(b.lastUpdated || 0).getTime();
            return timeB - timeA;
        });
    }, [truckLocations, sessions]);

    const trucksWithLocation = trucks.filter(t => t.hasLocation);

    return (
        <div className="card truck-list-panel">
            <div className="card-title">📍 Trucks on Map</div>
            
            {trucksWithLocation.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-state-icon">🗺️</div>
                    <p>No GPS data available</p>
                    <p style={{ fontSize: '0.75rem', marginTop: 4 }}>
                        Waiting for location updates...
                    </p>
                </div>
            ) : (
                <div className="truck-list">
                    {trucksWithLocation.map(truck => (
                        <div
                            key={truck.truckId}
                            className={`truck-list-item ${selectedTruckId === truck.truckId ? 'selected' : ''}`}
                            onClick={() => onSelectTruck(truck.truckId)}
                        >
                            <div className="truck-list-header">
                                <span className="truck-list-id">{truck.truckId}</span>
                                <span className={`badge ${STATE_BADGE[truck.state] || 'badge-blue'}`}>
                                    {truck.state}
                                </span>
                            </div>
                            <div className="truck-list-meta">
                                <span className="truck-list-coords">
                                    {truck.latitude?.toFixed(4)}, {truck.longitude?.toFixed(4)}
                                </span>
                                <span className="truck-list-time">
                                    {formatTime(truck.lastUpdated)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            <div className="truck-list-footer">
                <span className="truck-count">
                    {trucksWithLocation.length} truck{trucksWithLocation.length !== 1 ? 's' : ''} on map
                </span>
            </div>
        </div>
    );
}

export default TruckListPanel;
