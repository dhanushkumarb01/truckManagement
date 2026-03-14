import GpsEvent from '../models/GpsEvent.js';

const LOOKBACK_MINUTES = 30;

function toRadians(deg) {
    return (deg * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1, lon1, lat2, lon2) {
    const lat1r = toRadians(lat1);
    const lat2r = toRadians(lat2);
    const dLon = toRadians(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(lat2r);
    const x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180) / Math.PI;
}

function angleDiff(a, b) {
    let diff = Math.abs(a - b) % 360;
    if (diff > 180) diff = 360 - diff;
    return diff;
}

function computeMetrics(points) {
    if (points.length < 2) {
        return { avgSpeed: 0, stopFrequency: 0, routeDeviation: 0 };
    }

    let totalSpeedKmh = 0;
    let speedSamples = 0;
    let stopCount = 0;
    const bearings = [];

    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        const timeDiffHours =
            (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
            (1000 * 60 * 60);

        if (!Number.isFinite(timeDiffHours) || timeDiffHours <= 0) continue;

        const distKm =
            haversineDistanceMeters(prev.latitude, prev.longitude, curr.latitude, curr.longitude) /
            1000;

        const speedKmh = distKm / timeDiffHours;

        if (!Number.isFinite(speedKmh)) continue;

        totalSpeedKmh += speedKmh;
        speedSamples += 1;

        if (speedKmh < 2) {
            stopCount += 1;
        }

        bearings.push(bearingDegrees(prev.latitude, prev.longitude, curr.latitude, curr.longitude));
    }

    const avgSpeed = speedSamples > 0 ? totalSpeedKmh / speedSamples : 0;

    let totalDeviation = 0;
    let deviationSamples = 0;
    for (let i = 1; i < bearings.length; i++) {
        totalDeviation += angleDiff(bearings[i], bearings[i - 1]);
        deviationSamples += 1;
    }
    const routeDeviation = deviationSamples > 0 ? totalDeviation / deviationSamples : 0;

    return {
        avgSpeed: Number(avgSpeed.toFixed(1)),
        stopFrequency: stopCount,
        routeDeviation: Number(routeDeviation.toFixed(1)),
    };
}

function classifyDriver(avgSpeed, stopFrequency) {
    if (avgSpeed > 15 || stopFrequency > 10) {
        return 'Risky Driver';
    }
    if (avgSpeed >= 8 && avgSpeed <= 15 && stopFrequency >= 5 && stopFrequency <= 10) {
        return 'Average Driver';
    }
    return 'Efficient Driver';
}

export async function analyseDriverBehaviour() {
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    const events = await GpsEvent.find({ timestamp: { $gte: since } })
        .select('truckId latitude longitude timestamp')
        .sort({ truckId: 1, timestamp: 1 })
        .lean();

    if (!events.length) return [];

    const byTruck = new Map();
    for (const event of events) {
        const list = byTruck.get(event.truckId) || [];
        list.push(event);
        byTruck.set(event.truckId, list);
    }

    const results = [];

    for (const [truckId, points] of byTruck.entries()) {
        const { avgSpeed, stopFrequency, routeDeviation } = computeMetrics(points);
        const driverCategory = classifyDriver(avgSpeed, stopFrequency);

        results.push({
            truckId,
            avgSpeed,
            stopFrequency,
            routeDeviation,
            driverCategory,
        });
    }

    results.sort((a, b) => {
        const order = { 'Risky Driver': 0, 'Average Driver': 1, 'Efficient Driver': 2 };
        return order[a.driverCategory] - order[b.driverCategory];
    });

    return results;
}
