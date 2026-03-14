import TruckSession from '../models/TruckSession.js';
import GpsEvent from '../models/GpsEvent.js';

const YARD_CAPACITY = 150;

// Normalization caps chosen to keep score stable under typical yard load.
const MAX_DWELL_MINUTES = 180;
const MAX_QUEUE_LENGTH = 50;
const MAX_AVG_SPEED = 40;
const MAX_STOP_FREQUENCY = 60;

const WEIGHTS = {
    activeTrucks: 0.15,
    avgDwellTime: 0.25,
    queueLength: 0.25,
    zoneCongestion: 0.15,
    stopFrequency: 0.1,
    speedScore: 0.1,
};

function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

function classifyStressLevel(score) {
    if (score <= 30) return 'LOW_STRESS';
    if (score <= 60) return 'MEDIUM_STRESS';
    return 'HIGH_STRESS';
}

function buildDefaultResult() {
    return {
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
}

export async function calculateYardStressIndex() {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const [sessionStats, gpsStats] = await Promise.all([
        TruckSession.aggregate([
            { $match: { state: { $ne: 'EXITED' } } },
            {
                $group: {
                    _id: null,
                    activeTrucks: { $sum: 1 },
                    queueLength: {
                        $sum: {
                            $cond: [{ $eq: ['$state', 'TARE_DONE'] }, 1, 0],
                        },
                    },
                    avgDwellMs: {
                        $avg: {
                            $subtract: [now, { $ifNull: ['$entryTimestamp', now] }],
                        },
                    },
                },
            },
        ]),
        GpsEvent.aggregate([
            {
                $facet: {
                    avgSpeedStats: [
                        { $match: { speed: { $type: 'number' } } },
                        {
                            $group: {
                                _id: null,
                                avgSpeed: { $avg: '$speed' },
                            },
                        },
                    ],
                    stopStats: [
                        {
                            $match: {
                                timestamp: { $gte: tenMinutesAgo },
                                speed: { $lt: 3 },
                            },
                        },
                        { $count: 'stopFrequency' },
                    ],
                },
            },
        ]),
    ]);

    const session = sessionStats[0];
    const gps = gpsStats[0] || {};

    if (!session) {
        return buildDefaultResult();
    }

    const activeTrucks = Number(session.activeTrucks) || 0;
    const queueLength = Number(session.queueLength) || 0;
    const avgDwellTime = Math.max(0, Math.round((Number(session.avgDwellMs) || 0) / 60000));

    const avgSpeed = Number(gps?.avgSpeedStats?.[0]?.avgSpeed) || 0;
    const stopFrequency = Number(gps?.stopStats?.[0]?.stopFrequency) || 0;
    const zoneCongestion = clamp01(activeTrucks / YARD_CAPACITY);

    const activeTrucksNorm = clamp01(activeTrucks / YARD_CAPACITY);
    const avgDwellNorm = clamp01(avgDwellTime / MAX_DWELL_MINUTES);
    const queueLengthNorm = clamp01(queueLength / MAX_QUEUE_LENGTH);
    const zoneCongestionNorm = zoneCongestion;
    const stopFrequencyNorm = clamp01(stopFrequency / MAX_STOP_FREQUENCY);
    const avgSpeedNorm = clamp01(avgSpeed / MAX_AVG_SPEED);
    const speedScore = 1 - avgSpeedNorm;

    const stressRaw =
        activeTrucksNorm * WEIGHTS.activeTrucks +
        avgDwellNorm * WEIGHTS.avgDwellTime +
        queueLengthNorm * WEIGHTS.queueLength +
        zoneCongestionNorm * WEIGHTS.zoneCongestion +
        stopFrequencyNorm * WEIGHTS.stopFrequency +
        speedScore * WEIGHTS.speedScore;

    const stressScore = Math.round(clamp01(stressRaw) * 100);

    return {
        stressScore,
        stressLevel: classifyStressLevel(stressScore),
        metrics: {
            activeTrucks,
            avgDwellTime,
            queueLength,
            avgSpeed: Number(avgSpeed.toFixed(1)),
            stopFrequency,
            zoneCongestion: Number(zoneCongestion.toFixed(2)),
        },
    };
}
