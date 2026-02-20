import { useState } from 'react';

function StartSession({ onStart, loading, disabled }) {
    const [truckId, setTruckId] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (truckId.trim() && !loading) {
            onStart(truckId.trim());
        }
    };

    return (
        <div className="card">
            <div className="card-title">🚛 Start Truck Session</div>
            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="truckIdInput">Truck ID</label>
                    <input
                        id="truckIdInput"
                        className="input-field"
                        type="text"
                        placeholder="e.g. TRK-001"
                        value={truckId}
                        onChange={(e) => setTruckId(e.target.value)}
                        disabled={disabled || loading}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 12 }}
                    disabled={!truckId.trim() || loading || disabled}
                >
                    {loading ? <span className="spinner" /> : null}
                    {loading ? 'Starting...' : 'Start Session'}
                </button>
            </form>
        </div>
    );
}

export default StartSession;
