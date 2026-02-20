import { useState, useEffect, useCallback } from 'react';
import * as api from '../api';

const STATE_BADGE = {
    ENTRY: 'badge-blue',
    TARE_DONE: 'badge-amber',
    DOCK: 'badge-amber',
    GROSS_DONE: 'badge-green',
    INVOICE_GENERATED: 'badge-red',
    EXITED: 'badge-purple',
};

function formatTime(ts) {
    return new Date(ts).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function FleetOverview({ onSelectTruck }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchSessions = useCallback(async () => {
        const res = await api.getAllSessions();
        if (res.success) {
            setSessions(res.data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    const handleRowClick = (truckId, state) => {
        if (state !== 'EXITED') {
            onSelectTruck(truckId);
        }
    };

    return (
        <div className="fleet-container">
            <div className="card">
                <div className="card-title" style={{ marginBottom: 20 }}>
                    📊 Fleet Overview
                    {loading && <span className="spinner spinner-dark" style={{ marginLeft: 8 }} />}
                </div>

                {sessions.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px 0' }}>
                        <div className="empty-state-icon">🚛</div>
                        <p>No truck sessions found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Run the seed script or start a session</p>
                    </div>
                ) : (
                    <div className="fleet-table-wrap">
                        <table className="fleet-table">
                            <thead>
                                <tr>
                                    <th>Truck ID</th>
                                    <th>State</th>
                                    <th>Lock</th>
                                    <th>Visits</th>
                                    <th>Tare (kg)</th>
                                    <th>Gross (kg)</th>
                                    <th>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s) => (
                                    <tr
                                        key={s.truckId + s.createdAt}
                                        className={s.state !== 'EXITED' ? 'fleet-row-clickable' : ''}
                                        onClick={() => handleRowClick(s.truckId, s.state)}
                                    >
                                        <td className="fleet-truck-id">{s.truckId}</td>
                                        <td>
                                            <span className={`badge ${STATE_BADGE[s.state] || 'badge-blue'}`}>
                                                {s.state}
                                            </span>
                                        </td>
                                        <td>{s.movementLock ? '🔒' : '—'}</td>
                                        <td>{s.visitCount}</td>
                                        <td>{s.tareWeight != null ? s.tareWeight : '—'}</td>
                                        <td>{s.grossWeight != null ? s.grossWeight : '—'}</td>
                                        <td className="fleet-time">{formatTime(s.updatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FleetOverview;
