import GpsEvent from '../models/GpsEvent.js';

const LOOKBACK_MINUTES = 1440; // 24 hours (5 in production)
const CLUSTER_RADIUS_METERS = 50;
const HIGH_CONGESTION_MIN_TRUCKS = 5;
const HIGH_CONGESTION_MAX_AVG_SPEED_KMH = 8;

function toRadians(value) {
    return (value * Math.PI) / 180;
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const earthRadiusMeters = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusMeters * c;
}

function getSpeedKmh(pointA, pointB) {
    const start = new Date(pointA.timestamp).getTime();
    const end = new Date(pointB.timestamp).getTime();
    const timeDiffHours = (end - start) / (1000 * 60 * 60);

    if (!Number.isFinite(timeDiffHours) || timeDiffHours <= 0) {
        return 0;
    }

    const distanceMeters = haversineDistanceMeters(
        pointA.latitude,
        pointA.longitude,
        pointB.latitude,
        pointB.longitude
    );

    const distanceKm = distanceMeters / 1000;
    return distanceKm / timeDiffHours;
}

function buildTruckSnapshots(events) {
    const byTruck = new Map();

    for (const event of events) {
        const list = byTruck.get(event.truckId) || [];
        list.push(event);
        byTruck.set(event.truckId, list);
    }

    const snapshots = [];

    for (const [truckId, points] of byTruck.entries()) {
        if (!points.length) continue;

        const latest = points[points.length - 1];
        let speedKmh = 0;

        if (points.length >= 2) {
            const previous = points[points.length - 2];
            speedKmh = getSpeedKmh(previous, latest);
        }

        snapshots.push({
            truckId,
            latitude: latest.latitude,
            longitude: latest.longitude,
            speedKmh: Number.isFinite(speedKmh) ? speedKmh : 0,
        });
    }

    return snapshots;
}

function buildProximityClusters(snapshots) {
    const clusters = [];
    const visited = new Set();

    for (let i = 0; i < snapshots.length; i += 1) {
        if (visited.has(i)) continue;

        const queue = [i];
        const clusterIndexes = [];
        visited.add(i);

        while (queue.length) {
            const currentIndex = queue.shift();
            clusterIndexes.push(currentIndex);

            for (let j = 0; j < snapshots.length; j += 1) {
                if (visited.has(j)) continue;

                const distance = haversineDistanceMeters(
                    snapshots[currentIndex].latitude,
                    snapshots[currentIndex].longitude,
                    snapshots[j].latitude,
                    snapshots[j].longitude
                );

                if (distance <= CLUSTER_RADIUS_METERS) {
                    visited.add(j);
                    queue.push(j);
                }
            }
        }

        clusters.push(clusterIndexes.map((index) => snapshots[index]));
    }

    return clusters;
}

function summarizeCluster(cluster) {
    const truckCount = cluster.length;
    if (!truckCount) return null;

    const center = cluster.reduce(
        (acc, truck) => {
            acc.latitude += truck.latitude;
            acc.longitude += truck.longitude;
            acc.totalSpeed += truck.speedKmh;
            return acc;
        },
        { latitude: 0, longitude: 0, totalSpeed: 0 }
    );

    const averageSpeed = center.totalSpeed / truckCount;

    return {
        latitude: Number((center.latitude / truckCount).toFixed(6)),
        longitude: Number((center.longitude / truckCount).toFixed(6)),
        truckCount,
        avgSpeed: Number(averageSpeed.toFixed(1)),
        risk: 'HIGH',
    };
}

export async function detectCongestionZones() {
    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000);

    const recentEvents = await GpsEvent.find({
        timestamp: { $gte: since },
    })
        .select('truckId latitude longitude timestamp')
        .sort({ truckId: 1, timestamp: 1 })
        .lean();

    if (!recentEvents.length) {
        return [];
    }

    const snapshots = buildTruckSnapshots(recentEvents);
    if (!snapshots.length) {
        return [];
    }

    const clusters = buildProximityClusters(snapshots);

    return clusters
        .map(summarizeCluster)
        .filter(Boolean)
        .filter(
            (zone) =>
                zone.truckCount >= HIGH_CONGESTION_MIN_TRUCKS &&
                zone.avgSpeed <= HIGH_CONGESTION_MAX_AVG_SPEED_KMH
        );
}
