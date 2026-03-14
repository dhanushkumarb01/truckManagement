import { useEffect, useMemo, useState } from 'react';
import { getYardStress } from '../api';

const FALLBACK_DATA = {
    stressScore: 0,
    stressLevel: 'LOW_STRESS',
    metrics: {
        activeTrucks: 0,
        avgDwellTime: 0,
        queueLength: 0,
        avgSpeed: 0,
        stopFrequency: 0,
        zoneCongestion: 0,
    },
};

function getLevelColor(level) {
    if (level === 'HIGH_STRESS') return '#dc2626';
    if (level === 'MEDIUM_STRESS') return '#ea580c';
    return '#16a34a';
}

function formatLevel(level) {
    return String(level || 'LOW_STRESS').replace('_', ' ');
}

function YardStressPanel() {
    const [stressData, setStressData] = useState(FALLBACK_DATA);
    const [isUnavailable, setIsUnavailable] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const loadStress = async () => {
            try {
                const res = await getYardStress();
                if (!isMounted) return;

                if (res?.success && res?.data) {
                    setStressData(res.data);
                    setIsUnavailable(false);
                    return;
                }

                setIsUnavailable(true);
            } catch {
                if (isMounted) setIsUnavailable(true);
            }
        };

        loadStress();
        const intervalId = setInterval(loadStress, 10000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    const levelColor = useMemo(() => getLevelColor(stressData.stressLevel), [stressData.stressLevel]);

    return (
        <div
            style={{
                width: 260,
                background: '#ffffff',
                borderRadius: 10,
                padding: 16,
                boxShadow: '0 8px 22px rgba(0, 0, 0, 0.16)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                color: '#111827',
                pointerEvents: 'none',
            }}
            aria-live="polite"
        >
            <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>
                YARD STRESS INDEX
            </div>

            {isUnavailable ? (
                <div style={{ fontSize: 14, color: '#6b7280' }}>Stress data unavailable</div>
            ) : (
                <>
                    <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
                        Score: {stressData.stressScore} / 100
                    </div>

                    <div style={{ marginTop: 8, marginBottom: 10 }}>
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: levelColor,
                                background: `${levelColor}1a`,
                                padding: '4px 8px',
                                borderRadius: 999,
                            }}
                        >
                            Status: {formatLevel(stressData.stressLevel)}
                        </span>
                    </div>

                    <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                        <div>Active Trucks: {stressData.metrics?.activeTrucks ?? 0}</div>
                        <div>Queue Length: {stressData.metrics?.queueLength ?? 0}</div>
                        <div>Average Speed: {stressData.metrics?.avgSpeed ?? 0} km/h</div>
                        <div>Average Dwell Time: {stressData.metrics?.avgDwellTime ?? 0} minutes</div>
                    </div>
                </>
            )}
        </div>
    );
}

export default YardStressPanel;
