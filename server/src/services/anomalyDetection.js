/**
 * Anomaly Detection Engine
 * Detects GPS spoofing, unrealistic movements, and coordinate anomalies.
 * 
 * IMPORTANT: This logs anomalies but does NOT reject location data.
 * Continuous tracking is maintained for audit purposes.
 */

import AnomalyEvent from '../models/AnomalyEvent.js';
import GpsEvent from '../models/GpsEvent.js';

// ============ CONFIGURATION ============

/**
 * Anomaly detection thresholds for industrial yard environment.
 * Conservative values to minimize false positives.
 */
export const ANOMALY_THRESHOLDS = {
    // Maximum realistic speed inside yard (km/h)
    // Industrial trucks typically max 20-30 km/h, buffer to 60
    MAX_SPEED_KMH: 60,
    
    // Maximum instant jump distance (meters)
    // Indicates teleportation/spoofing if exceeded
    MAX_TELEPORT_DISTANCE: 500,
    
    // Minimum time between locations to calculate speed (seconds)
    // Prevents division by very small numbers
    MIN_TIME_DELTA: 1,
    
    // Maximum acceptable GPS accuracy (meters)
    // Higher values indicate unreliable readings
    MAX_ACCURACY: 100,
    
    // Minimum distance to consider movement (meters)
    // Prevents flagging stationary vehicles
    MIN_MOVEMENT_DISTANCE: 2,
    
    // Maximum time gap before timestamp anomaly (seconds)
    MAX_TIME_GAP: 300, // 5 minutes
};

// ============ HAVERSINE FORMULA ============

/**
 * Calculate distance between two coordinates using Haversine formula.
 * Returns distance in meters.
 * 
 * @param {number} lat1 - First latitude
 * @param {number} lng1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lng2 - Second longitude
 * @returns {number} - Distance in meters
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth's radius in meters
    
    const toRad = (deg) => (deg * Math.PI) / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

/**
 * Calculate speed between two GPS points.
 * 
 * @param {number} distance - Distance in meters
 * @param {number} timeDelta - Time difference in seconds
 * @returns {number} - Speed in km/h
 */
export function calculateSpeed(distance, timeDelta) {
    if (timeDelta <= 0) return 0;
    
    // Convert m/s to km/h
    const speedMps = distance / timeDelta;
    return speedMps * 3.6;
}

// ============ ANOMALY DETECTION ============

/**
 * Detect anomalies in a new GPS location relative to previous location.
 * Returns array of detected anomalies.
 * 
 * @param {Object} newLocation - New GPS event data
 * @param {Object} previousLocation - Previous GPS event data (can be null)
 * @param {Object} options - Optional threshold overrides
 * @returns {Promise<Array>} - Array of anomaly objects
 */
export async function detectAnomalies(newLocation, previousLocation, options = {}) {
    const thresholds = { ...ANOMALY_THRESHOLDS, ...options };
    const anomalies = [];
    
    const {
        truckId,
        sessionId,
        latitude,
        longitude,
        accuracy,
        timestamp
    } = newLocation;
    
    // Check accuracy anomaly
    if (accuracy && accuracy > thresholds.MAX_ACCURACY) {
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'ACCURACY_POOR',
            severity: accuracy > thresholds.MAX_ACCURACY * 2 ? 'HIGH' : 'MEDIUM',
            latitude,
            longitude,
            accuracy,
            thresholdUsed: {
                accuracyThreshold: thresholds.MAX_ACCURACY,
            },
            timestamp: new Date(timestamp),
        });
    }
    
    // If no previous location, skip movement-based anomalies
    if (!previousLocation) {
        return anomalies;
    }
    
    // Calculate movement metrics
    const distance = haversineDistance(
        previousLocation.latitude,
        previousLocation.longitude,
        latitude,
        longitude
    );
    
    const prevTime = new Date(previousLocation.timestamp).getTime();
    const newTime = new Date(timestamp).getTime();
    const timeDelta = (newTime - prevTime) / 1000; // seconds
    
    // Check timestamp anomaly
    if (timeDelta < 0) {
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'TIMESTAMP_ANOMALY',
            severity: 'HIGH',
            latitude,
            longitude,
            accuracy,
            timeDelta,
            previousLatitude: previousLocation.latitude,
            previousLongitude: previousLocation.longitude,
            timestamp: new Date(timestamp),
        });
        // Don't calculate speed with negative time
        return anomalies;
    }
    
    // Check for large time gap
    if (timeDelta > thresholds.MAX_TIME_GAP) {
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'TIMESTAMP_ANOMALY',
            severity: 'LOW',
            latitude,
            longitude,
            timeDelta,
            timestamp: new Date(timestamp),
        });
    }
    
    // Check for duplicate location
    if (distance < 0.1 && timeDelta > 30) {
        // Same location for more than 30 seconds - might be stuck or simulated
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'DUPLICATE_LOCATION',
            severity: 'LOW',
            latitude,
            longitude,
            distance,
            timeDelta,
            previousLatitude: previousLocation.latitude,
            previousLongitude: previousLocation.longitude,
            timestamp: new Date(timestamp),
        });
    }
    
    // Skip speed calculation for minimal movement
    if (distance < thresholds.MIN_MOVEMENT_DISTANCE) {
        return anomalies;
    }
    
    // Skip speed calculation for very small time delta
    if (timeDelta < thresholds.MIN_TIME_DELTA) {
        return anomalies;
    }
    
    const speedKmh = calculateSpeed(distance, timeDelta);
    
    // Check teleportation (large distance jump)
    if (distance > thresholds.MAX_TELEPORT_DISTANCE) {
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'TELEPORT',
            severity: 'CRITICAL',
            calculatedSpeed: speedKmh,
            distance,
            timeDelta,
            latitude,
            longitude,
            accuracy,
            previousLatitude: previousLocation.latitude,
            previousLongitude: previousLocation.longitude,
            thresholdUsed: {
                distanceThreshold: thresholds.MAX_TELEPORT_DISTANCE,
            },
            timestamp: new Date(timestamp),
        });
    }
    // Check speed violation
    else if (speedKmh > thresholds.MAX_SPEED_KMH) {
        const severity = speedKmh > thresholds.MAX_SPEED_KMH * 2 
            ? 'CRITICAL' 
            : speedKmh > thresholds.MAX_SPEED_KMH * 1.5 
                ? 'HIGH' 
                : 'MEDIUM';
        
        anomalies.push({
            truckId,
            sessionId: sessionId || truckId,
            anomalyType: 'SPEED_VIOLATION',
            severity,
            calculatedSpeed: speedKmh,
            distance,
            timeDelta,
            latitude,
            longitude,
            accuracy,
            previousLatitude: previousLocation.latitude,
            previousLongitude: previousLocation.longitude,
            thresholdUsed: {
                speedThreshold: thresholds.MAX_SPEED_KMH,
            },
            timestamp: new Date(timestamp),
        });
    }
    
    return anomalies;
}

/**
 * Get the last known location for a truck/session.
 * 
 * @param {string} truckId - Truck identifier
 * @returns {Promise<Object|null>} - Last GPS event or null
 */
export async function getLastKnownLocation(truckId) {
    return GpsEvent.findOne({ truckId })
        .sort({ timestamp: -1 })
        .lean();
}

/**
 * Process and log anomalies to database.
 * HARDENED: Includes event throttling to prevent flood (Fix #5)
 * 
 * @param {Array} anomalies - Array of anomaly objects
 * @param {number} throttleWindowSec - Throttle window in seconds (default 60)
 * @returns {Promise<Array>} - Created anomaly events
 */
export async function logAnomalies(anomalies, throttleWindowSec = 60) {
    if (!anomalies || anomalies.length === 0) {
        return [];
    }
    
    try {
        const throttledAnomalies = [];
        const throttleCutoff = new Date(Date.now() - throttleWindowSec * 1000);
        
        // Filter out throttled anomalies
        for (const anomaly of anomalies) {
            // Check if same anomalyType for same truckId exists within throttle window
            const recentExists = await AnomalyEvent.findOne({
                truckId: anomaly.truckId,
                anomalyType: anomaly.anomalyType,
                timestamp: { $gte: throttleCutoff }
            }).lean();
            
            if (!recentExists) {
                throttledAnomalies.push(anomaly);
            } else {
                console.log(`⏭️ Throttled ${anomaly.anomalyType} for ${anomaly.truckId}`);
            }
        }
        
        if (throttledAnomalies.length === 0) {
            return [];
        }
        
        const created = await AnomalyEvent.insertMany(throttledAnomalies);
        console.log(`⚠️ Logged ${created.length} anomalies (${anomalies.length - throttledAnomalies.length} throttled)`);
        return created;
    } catch (error) {
        console.error('Failed to log anomalies:', error.message);
        return [];
    }
}

/**
 * Full anomaly detection pipeline for a new location.
 * HARDENED: Accepts yardConfig for configurable thresholds (Fix #6)
 * 
 * @param {Object} newLocation - New GPS event data
 * @param {Object} yardConfig - Yard configuration (optional)
 * @returns {Promise<Array>} - Detected anomalies
 */
export async function runAnomalyDetection(newLocation, yardConfig = null) {
    try {
        // Get previous location
        const previousLocation = await getLastKnownLocation(newLocation.truckId);
        
        // Build threshold overrides from yard config
        const thresholdOverrides = yardConfig ? {
            MAX_SPEED_KMH: yardConfig.maxSpeedKmh || ANOMALY_THRESHOLDS.MAX_SPEED_KMH,
            MAX_TELEPORT_DISTANCE: yardConfig.maxTeleportDistanceM || ANOMALY_THRESHOLDS.MAX_TELEPORT_DISTANCE,
            MAX_ACCURACY: yardConfig.maxAccuracyM || ANOMALY_THRESHOLDS.MAX_ACCURACY,
        } : {};
        
        // Detect anomalies with config-based thresholds
        const anomalies = await detectAnomalies(newLocation, previousLocation, thresholdOverrides);
        
        // Log to database with throttling
        if (anomalies.length > 0) {
            const throttleWindow = yardConfig?.eventThrottleWindowSec || 60;
            await logAnomalies(anomalies, throttleWindow);
        }
        
        return anomalies;
    } catch (error) {
        console.error('Anomaly detection failed:', error.message);
        return [];
    }
}
