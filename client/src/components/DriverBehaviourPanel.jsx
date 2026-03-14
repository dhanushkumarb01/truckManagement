import { useEffect, useState } from 'react';
import { getDriverBehaviour } from '../api';

const CATEGORY_COLORS = {
    'Risky Driver': '#dc2626',
    'Average Driver': '#ea580c',
    'Efficient Driver': '#16a34a',
};

const CATEGORY_BG = {
    'Risky Driver': '#fef2f2',
    'Average Driver': '#fff7ed',
    'Efficient Driver': '#f0fdf4',
};

const CATEGORY_ICON = {
    'Risky Driver': '⚠️',
    'Average Driver': '🟡',
    'Efficient Driver': '✅',
};

function DriverBehaviourPanel() {
    const [drivers, setDrivers] = useState([]);
    const [unavailable, setUnavailable] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            try {
                const res = await getDriverBehaviour();
                if (!isMounted) return;
                if (res?.success && Array.isArray(res.drivers)) {
                    setDrivers(res.drivers);
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
            style={{
                width: 260,
                background: '#ffffff',
                borderRadius: 10,
                padding: 16,
                boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
                border: '1px solid rgba(15,23,42,0.08)',
                color: '#111827',
                pointerEvents: 'none',
            }}
        >
            <div style={{ fontSize: 12, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 10 }}>
                DRIVER BEHAVIOUR MONITOR
            </div>

            {unavailable ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>Behaviour data unavailable</div>
            ) : drivers.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>No truck data in last 30 min</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {drivers.slice(0, 5).map((driver) => {
                        const color = CATEGORY_COLORS[driver.driverCategory] ?? '#374151';
                        const bg = CATEGORY_BG[driver.driverCategory] ?? '#f9fafb';
                        const icon = CATEGORY_ICON[driver.driverCategory] ?? '•';
                        return (
                            <div
                                key={driver.truckId}
                                style={{
                                    background: bg,
                                    border: `1px solid ${color}33`,
                                    borderRadius: 6,
                                    padding: '6px 8px',
                                    fontSize: 12,
                                    lineHeight: 1.5,
                                }}
                            >
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>
                                    {icon} {driver.truckId}
                                </div>
                                <div style={{ color, fontWeight: 600, fontSize: 11 }}>
                                    {driver.driverCategory}
                                </div>
                                <div style={{ color: '#6b7280', fontSize: 11 }}>
                                    Avg Speed: {driver.avgSpeed} km/h · Stops: {driver.stopFrequency}
                                </div>
                            </div>
                        );
                    })}
                    {drivers.length > 5 && (
                        <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
                            +{drivers.length - 5} more trucks
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DriverBehaviourPanel;
