import { useEffect, useState } from 'react';
import { getDelayPredictions } from '../api';

const RISK_COLORS = {
    ON_TIME: '#16a34a',
    POSSIBLE_DELAY: '#d97706',
    HIGH_DELAY_RISK: '#dc2626',
};

const RISK_BACKGROUNDS = {
    ON_TIME: 'rgba(34, 197, 94, 0.12)',
    POSSIBLE_DELAY: 'rgba(245, 158, 11, 0.12)',
    HIGH_DELAY_RISK: 'rgba(239, 68, 68, 0.12)',
};

function DelayPredictionPanel() {
    const [predictions, setPredictions] = useState([]);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const res = await getDelayPredictions();
                if (!isMounted) return;

                if (res?.success && Array.isArray(res.predictions)) {
                    setPredictions(res.predictions);
                    setUnavailable(false);
                } else {
                    setUnavailable(true);
                }
            } catch {
                if (isMounted) setUnavailable(true);
            }
        };

        load();
        const id = setInterval(load, 15000);

        return () => {
            isMounted = false;
            clearInterval(id);
        };
    }, []);

    return (
        <div
            className="card delay-prediction-panel"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
            }}
        >
            <div className="card-title">⏱ Delay Prediction</div>

            {unavailable ? (
                <div
                    style={{
                        color: '#ef4444',
                        padding: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        fontSize: '12px',
                    }}
                >
                    Delay data unavailable
                </div>
            ) : predictions.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '40px 20px',
                        color: '#9ca3af',
                        fontSize: '13px',
                    }}
                >
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                    <div>No active sessions</div>
                </div>
            ) : (
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '400px',
                        overflowY: 'auto',
                    }}
                >
                    {predictions.map((item) => {
                        const color = RISK_COLORS[item.delayRisk] ?? '#374151';
                        const background = RISK_BACKGROUNDS[item.delayRisk] ?? 'rgba(255, 255, 255, 0.06)';

                        return (
                            <div
                                key={item.truckId}
                                style={{
                                    background,
                                    border: `1px solid ${color}55`,
                                    borderRadius: 6,
                                    padding: '10px 12px',
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                }}
                            >
                                <div style={{ fontWeight: 700, marginBottom: 4 }}>🚛 {item.truckId}</div>
                                <div style={{ color, fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
                                    {item.delayRisk}
                                </div>
                                <div style={{ color: '#d1d5db', fontSize: 11 }}>
                                    State: {item.state}
                                </div>
                                <div style={{ color: '#d1d5db', fontSize: 11 }}>
                                    Dwell: {item.dwellTime} min
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default DelayPredictionPanel;
