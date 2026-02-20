function TruckSelector({ sessions, selectedTruckId, onSelect }) {
    const activeSessions = sessions.filter((s) => s.state !== 'EXITED');

    if (activeSessions.length === 0) return null;

    return (
        <div className="card" style={{ padding: '14px 18px' }}>
            <div className="card-title" style={{ marginBottom: 10 }}>🔄 Active Trucks</div>
            <select
                className="input-field"
                style={{ width: '100%' }}
                value={selectedTruckId || ''}
                onChange={(e) => onSelect(e.target.value)}
            >
                <option value="">— Select a truck —</option>
                {activeSessions.map((s) => (
                    <option key={s.truckId} value={s.truckId}>
                        {s.truckId} — {s.state}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default TruckSelector;
