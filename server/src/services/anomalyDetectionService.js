import EventLog from '../models/EventLog.js';
import GpsEvent from '../models/GpsEvent.js';
import TruckSession from '../models/TruckSession.js';
import YardConfig from '../models/YardConfig.js';

const RECENT_WINDOW_MS = 10 * 60 * 1000;
const LONG_STOP_ANALYSIS_WINDOW_MS = 30 * 60 * 1000;
const LONG_STOP_THRESHOLD_MINUTES = 20;
const SPEED_ANOMALY_THRESHOLD_KMH = 25;
const LONG_STOP_SPEED_THRESHOLD_KMH = 1;
const LONG_STOP_MIN_MOVEMENT_METERS = 5;
const SPEED_DEVIATION_MULTIPLIER = 2.5;
const MOVEMENT_ANOMALY_MULTIPLIER = 3;
const BASELINE_MIN_POINTS = 2;
const RUN_INTERVAL_MS = 20 * 1000;

const EVENT_TYPES = {
    SPEED_ANOMALY: 'SPEED_ANOMALY',
    LONG_STOP: 'LONG_STOP',
    OUT_OF_YARD: 'OUT_OF_YARD',
    SPEED_DEVIATION: 'SPEED_DEVIATION',
    MOVEMENT_ANOMALY: 'MOVEMENT_ANOMALY',
};

const DEDUPE_WINDOWS_MS = {
    SPEED_ANOMALY: 2 * 60 * 1000,
    LONG_STOP: 10 * 60 * 1000,
    OUT_OF_YARD: 3 * 60 * 1000,
    SPEED_DEVIATION: 3 * 60 * 1000,
    MOVEMENT_ANOMALY: 3 * 60 * 1000,
};

let intervalId = null;
let isRunning = false;

function haversineMeters(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusMeters = 6371000;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
}

function calculateSpeedKmh(prevPoint, nextPoint) {
    const distanceMeters = haversineMeters(
        prevPoint.latitude,
        prevPoint.longitude,
        nextPoint.latitude,
        nextPoint.longitude
    );

    const dtSeconds =
        (new Date(nextPoint.timestamp).getTime() - new Date(prevPoint.timestamp).getTime()) / 1000;

    if (dtSeconds <= 0) {
        return 0;
    }

    return (distanceMeters / dtSeconds) * 3.6;
}

function groupByTruck(events) {
    const grouped = new Map();

    for (const event of events) {
        if (!grouped.has(event.truckId)) {
            grouped.set(event.truckId, []);
        }
        grouped.get(event.truckId).push(event);
    }

    for (const truckEvents of grouped.values()) {
        truckEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    return grouped;
}

function getActiveSessionMap(sessions) {
    const sessionMap = new Map();

    for (const session of sessions) {
        if (!sessionMap.has(session.truckId)) {
            sessionMap.set(session.truckId, session);
        }
    }

    return sessionMap;
}

function computeTruckBaselines(groupedLongWindowEvents) {
    const baselineByTruck = new Map();

    for (const [truckId, events] of groupedLongWindowEvents.entries()) {
        if (!events || events.length <= BASELINE_MIN_POINTS) {
            continue;
        }

        let speedSum = 0;
        let speedCount = 0;
        let distanceSum = 0;
        let distanceCount = 0;

        for (let i = 1; i < events.length; i += 1) {
            const prev = events[i - 1];
            const current = events[i];

            const distanceMeters = haversineMeters(
                prev.latitude,
                prev.longitude,
                current.latitude,
                current.longitude
            );

            const dtSeconds =
                (new Date(current.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;

            if (dtSeconds <= 0) {
                continue;
            }

            const speedKmh = (distanceMeters / dtSeconds) * 3.6;

            speedSum += speedKmh;
            speedCount += 1;

            distanceSum += distanceMeters;
            distanceCount += 1;
        }

        if (!speedCount || !distanceCount) {
            continue;
        }

        baselineByTruck.set(truckId, {
            averageSpeed: speedSum / speedCount,
            averageMovementDistance: distanceSum / distanceCount,
        });
    }

    return baselineByTruck;
}

async function createEventLogAlert({
    eventType,
    severity,
    truckId,
    message,
    sessionId,
    metadata = {},
    timestamp = new Date(),
}) {
    const dedupeWindowMs = DEDUPE_WINDOWS_MS[eventType] || 2 * 60 * 1000;
    const dedupeSince = new Date(Date.now() - dedupeWindowMs);

    const existing = await EventLog.findOne({
        truckId,
        eventType,
        timestamp: { $gte: dedupeSince },
    })
        .sort({ timestamp: -1 })
        .lean();

    if (existing) {
        return null;
    }

    return EventLog.create({
        truckId,
        sessionId,
        eventType,
        severity,
        message,
        timestamp,
        metadata: {
            type: 'ANOMALY',
            subType: eventType,
            ...metadata,
        },
    });
}

async function detectSpeedAnomalies(groupedRecentEvents, activeSessionMap) {
    const alerts = [];

    for (const [truckId, events] of groupedRecentEvents.entries()) {
        for (let i = 1; i < events.length; i += 1) {
            const prev = events[i - 1];
            const current = events[i];
            const speedKmh = calculateSpeedKmh(prev, current);

            if (speedKmh <= SPEED_ANOMALY_THRESHOLD_KMH) {
                continue;
            }

            const session = activeSessionMap.get(truckId);
            alerts.push(
                createEventLogAlert({
                    eventType: EVENT_TYPES.SPEED_ANOMALY,
                    severity: 'high',
                    truckId,
                    sessionId: session?.sessionId,
                    timestamp: new Date(current.timestamp),
                    message: `Truck moving at abnormal speed (${speedKmh.toFixed(1)} km/h)`,
                    metadata: {
                        speedKmh: Number(speedKmh.toFixed(2)),
                        thresholdKmh: SPEED_ANOMALY_THRESHOLD_KMH,
                        latitude: current.latitude,
                        longitude: current.longitude,
                    },
                })
            );

            break;
        }
    }

    return Promise.all(alerts);
}

async function detectLongStops(groupedLongWindowEvents, activeSessionMap) {
    const alerts = [];
    const nowMs = Date.now();

    for (const [truckId, events] of groupedLongWindowEvents.entries()) {
        if (!events.length) {
            continue;
        }

        const first = events[0];
        const last = events[events.length - 1];

        const durationMinutes =
            (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 60000;

        let speedKmh = 0;

        if (events.length > 1) {
            const distanceMeters = haversineMeters(
                first.latitude,
                first.longitude,
                last.latitude,
                last.longitude
            );

            const durationHours = durationMinutes / 60;
            speedKmh = durationHours > 0 ? (distanceMeters / 1000) / durationHours : 0;

            if (distanceMeters <= LONG_STOP_MIN_MOVEMENT_METERS) {
                speedKmh = 0;
            }
        } else {
            const idleMinutes = (nowMs - new Date(last.timestamp).getTime()) / 60000;
            if (idleMinutes >= LONG_STOP_THRESHOLD_MINUTES) {
                speedKmh = 0;
            }
        }

        const effectiveDurationMinutes =
            events.length > 1 ? durationMinutes : (nowMs - new Date(last.timestamp).getTime()) / 60000;

        if (
            effectiveDurationMinutes < LONG_STOP_THRESHOLD_MINUTES ||
            speedKmh >= LONG_STOP_SPEED_THRESHOLD_KMH
        ) {
            continue;
        }

        const session = activeSessionMap.get(truckId);
        alerts.push(
            createEventLogAlert({
                eventType: EVENT_TYPES.LONG_STOP,
                severity: 'medium',
                truckId,
                sessionId: session?.sessionId,
                timestamp: new Date(last.timestamp),
                message: `Truck stopped for unusually long time (${Math.floor(effectiveDurationMinutes)} min)`,
                metadata: {
                    durationMinutes: Math.floor(effectiveDurationMinutes),
                    speedKmh: Number(speedKmh.toFixed(2)),
                    thresholdKmh: LONG_STOP_SPEED_THRESHOLD_KMH,
                    latitude: last.latitude,
                    longitude: last.longitude,
                },
            })
        );
    }

    return Promise.all(alerts);
}

async function detectOutOfYard(groupedRecentEvents, activeSessionMap) {
    const yardConfig = await YardConfig.getConfig('DEFAULT_YARD');
    const alerts = [];

    for (const [truckId, events] of groupedRecentEvents.entries()) {
        if (!events.length) {
            continue;
        }

        const latest = events[events.length - 1];
        const isInside = YardConfig.isPointInsideBoundary(yardConfig, latest.latitude, latest.longitude);

        if (isInside) {
            continue;
        }

        const session = activeSessionMap.get(truckId);
        alerts.push(
            createEventLogAlert({
                eventType: EVENT_TYPES.OUT_OF_YARD,
                severity: 'high',
                truckId,
                sessionId: session?.sessionId,
                timestamp: new Date(latest.timestamp),
                message: 'Truck moved outside yard boundary',
                metadata: {
                    latitude: latest.latitude,
                    longitude: latest.longitude,
                    boundaryType: yardConfig?.boundaryType || 'circle',
                },
            })
        );
    }

    return Promise.all(alerts);
}

async function detectBehaviourBaselineAnomalies(groupedRecentEvents, baselineByTruck, activeSessionMap) {
    const alerts = [];

    for (const [truckId, events] of groupedRecentEvents.entries()) {
        if (!events || events.length < 2) {
            continue;
        }

        const baseline = baselineByTruck.get(truckId);
        if (!baseline) {
            continue;
        }

        const previous = events[events.length - 2];
        const current = events[events.length - 1];

        const currentDistanceMeters = haversineMeters(
            previous.latitude,
            previous.longitude,
            current.latitude,
            current.longitude
        );

        const currentSpeedKmh = calculateSpeedKmh(previous, current);
        const session = activeSessionMap.get(truckId);

        if (
            baseline.averageSpeed > 0 &&
            currentSpeedKmh > baseline.averageSpeed * SPEED_DEVIATION_MULTIPLIER
        ) {
            alerts.push(
                createEventLogAlert({
                    eventType: EVENT_TYPES.SPEED_DEVIATION,
                    severity: 'high',
                    truckId,
                    sessionId: session?.sessionId,
                    timestamp: new Date(current.timestamp),
                    message: 'Speed deviated significantly from normal behaviour',
                    metadata: {
                        currentSpeedKmh: Number(currentSpeedKmh.toFixed(2)),
                        baselineSpeedKmh: Number(baseline.averageSpeed.toFixed(2)),
                        multiplier: SPEED_DEVIATION_MULTIPLIER,
                        latitude: current.latitude,
                        longitude: current.longitude,
                    },
                })
            );
        }

        if (
            baseline.averageMovementDistance > 0 &&
            currentDistanceMeters > baseline.averageMovementDistance * MOVEMENT_ANOMALY_MULTIPLIER
        ) {
            alerts.push(
                createEventLogAlert({
                    eventType: EVENT_TYPES.MOVEMENT_ANOMALY,
                    severity: 'medium',
                    truckId,
                    sessionId: session?.sessionId,
                    timestamp: new Date(current.timestamp),
                    message: 'Unusual movement pattern detected',
                    metadata: {
                        currentDistanceMeters: Number(currentDistanceMeters.toFixed(2)),
                        baselineMovementDistanceMeters: Number(
                            baseline.averageMovementDistance.toFixed(2)
                        ),
                        multiplier: MOVEMENT_ANOMALY_MULTIPLIER,
                        latitude: current.latitude,
                        longitude: current.longitude,
                    },
                })
            );
        }
    }

    return Promise.all(alerts);
}

export async function runAnomalyDetectionCycle() {
    const now = Date.now();
    const recentWindowStart = new Date(now - RECENT_WINDOW_MS);
    const longWindowStart = new Date(now - LONG_STOP_ANALYSIS_WINDOW_MS);

    const [recentEvents, longWindowEvents, activeSessions] = await Promise.all([
        GpsEvent.find({
            timestamp: { $gte: recentWindowStart },
        })
            .sort({ timestamp: 1 })
            .lean(),
        GpsEvent.find({
            timestamp: { $gte: longWindowStart },
        })
            .sort({ timestamp: 1 })
            .lean(),
        TruckSession.find({
            state: { $ne: 'EXITED' },
        })
            .select('truckId sessionId state')
            .lean(),
    ]);

    if (!recentEvents.length) {
        return { created: 0, scannedTrucks: 0 };
    }

    const groupedRecent = groupByTruck(recentEvents);
    const recentTruckIds = new Set(groupedRecent.keys());

    const groupedLong = groupByTruck(
        longWindowEvents.filter((event) => recentTruckIds.has(event.truckId))
    );

    const activeSessionMap = getActiveSessionMap(activeSessions);
    const baselineByTruck = computeTruckBaselines(groupedLong);

    const [speedAlerts, longStopAlerts, outOfYardAlerts, baselineAlerts] = await Promise.all([
        detectSpeedAnomalies(groupedRecent, activeSessionMap),
        detectLongStops(groupedLong, activeSessionMap),
        detectOutOfYard(groupedRecent, activeSessionMap),
        detectBehaviourBaselineAnomalies(groupedRecent, baselineByTruck, activeSessionMap),
    ]);

    const created = [
        ...speedAlerts,
        ...longStopAlerts,
        ...outOfYardAlerts,
        ...baselineAlerts,
    ].filter(Boolean).length;

    return {
        created,
        scannedTrucks: groupedRecent.size,
    };
}

export function startAnomalyDetectionEngine() {
    if (intervalId) {
        return intervalId;
    }

    const runCycleSafely = async () => {
        if (isRunning) {
            return;
        }

        isRunning = true;
        try {
            const result = await runAnomalyDetectionCycle();
            if (result.created > 0) {
                console.log(
                    `[AnomalyEngine] Created ${result.created} alerts across ${result.scannedTrucks} trucks`
                );
            }
        } catch (error) {
            console.error('[AnomalyEngine] Detection cycle failed:', error.message);
        } finally {
            isRunning = false;
        }
    };

    void runCycleSafely();

    intervalId = setInterval(async () => {
        await runCycleSafely();
    }, RUN_INTERVAL_MS);

    console.log(`[AnomalyEngine] Started with ${RUN_INTERVAL_MS / 1000}s interval`);

    return intervalId;
}

export function stopAnomalyDetectionEngine() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}
