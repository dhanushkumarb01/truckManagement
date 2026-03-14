import TruckSession from '../models/TruckSession.js';

function classifyDelayRisk(dwellTimeMinutes) {
    if (dwellTimeMinutes < 20) {
        return 'ON_TIME';
    }
    if (dwellTimeMinutes > 40) {
        return 'HIGH_DELAY_RISK';
    }
    return 'POSSIBLE_DELAY';
}

export async function getOperationalDelayPredictions() {
    const now = Date.now();

    const activeSessions = await TruckSession.find({ state: { $ne: 'EXITED' } })
        .select('truckId state entryTimestamp')
        .lean();

    if (!activeSessions.length) {
        return [];
    }

    return activeSessions
        .map((session) => {
            const entryTime = new Date(session.entryTimestamp).getTime();
            const dwellTime = Number.isFinite(entryTime)
                ? Math.max(0, Math.round((now - entryTime) / 60000))
                : 0;

            return {
                truckId: session.truckId,
                state: session.state,
                dwellTime,
                delayRisk: classifyDelayRisk(dwellTime),
            };
        })
        .sort((a, b) => b.dwellTime - a.dwellTime);
}
