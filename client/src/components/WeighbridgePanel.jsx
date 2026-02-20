import { useState } from 'react';

function WeighbridgePanel({ session, onTare, onGross, loading }) {
    const [tareWeight, setTareWeight] = useState('');
    const [grossWeight, setGrossWeight] = useState('');

    const state = session?.state;
    const tareEnabled = state === 'ENTRY' && !loading;
    const grossEnabled = state === 'DOCK' && !loading;

    const handleTare = (e) => {
        e.preventDefault();
        if (tareWeight && !loading) {
            onTare(Number(tareWeight));
        }
    };

    const handleGross = (e) => {
        e.preventDefault();
        if (grossWeight && !loading) {
            onGross(Number(grossWeight));
        }
    };

    return (
        <div className="card">
            <div className="card-title">⚖️ Weighbridge</div>

            {/* Tare Weight */}
            <form onSubmit={handleTare} style={{ marginBottom: 16 }}>
                <div className="input-group">
                    <label htmlFor="tareInput">Tare Weight (kg)</label>
                    <input
                        id="tareInput"
                        className="input-field"
                        type="number"
                        min="1"
                        placeholder="Enter tare weight"
                        value={tareWeight}
                        onChange={(e) => setTareWeight(e.target.value)}
                        disabled={!tareEnabled}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={!tareEnabled || !tareWeight}
                >
                    {loading && state === 'ENTRY' ? <span className="spinner" /> : null}
                    {loading && state === 'ENTRY' ? 'Recording...' : 'Record Tare'}
                </button>
            </form>

            {/* Gross Weight */}
            <form onSubmit={handleGross}>
                <div className="input-group">
                    <label htmlFor="grossInput">Gross Weight (kg)</label>
                    <input
                        id="grossInput"
                        className="input-field"
                        type="number"
                        min="1"
                        placeholder="Enter gross weight"
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                        disabled={!grossEnabled}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-success"
                    style={{ width: '100%', marginTop: 8 }}
                    disabled={!grossEnabled || !grossWeight}
                >
                    {loading && state === 'DOCK' ? <span className="spinner" /> : null}
                    {loading && state === 'DOCK' ? 'Recording...' : 'Record Gross'}
                </button>
            </form>
        </div>
    );
}

export default WeighbridgePanel;
