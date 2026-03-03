/**
 * Truck Proximity Detection Service
 * HARDENED: Uses MongoDB 2dsphere geo query instead of O(n²) loop (Fix #4)
 * 
 * Detects when trucks are too close to each other in the yard.
 */

import YardSession from '../models/YardSession.js';
import EventLog from '../models/EventLog.js';

// Default proximity alert distance (meters)
const DEFAULT_PROXIMITY_ALERT_M = 10;

// Throttle window for proximity alerts (seconds)
const PROXIMITY_ALERT_THROTTLE_SEC = 60;

// Track recently alerted pairs to prevent duplicates (in-memory with TTL)
// Format: "sessionA:sessionB" -> timestamp
const recentAlerts = new Map();

/**
 * Clean up expired alerts from tracking map
 */
function cleanupRecentAlerts() {
    const cutoff = Date.now() - (PROXIMITY_ALERT_THROTTLE_SEC * 1000);
    for (const [key, timestamp] of recentAlerts) {
        if (timestamp < cutoff) {
            recentAlerts.delete(key);
        }
    }
}

/**
 * Generate canonical pair key (A:B where A < B alphabetically)
 * Prevents double-reporting A-B and B-A
 */
function getPairKey(sessionId1, sessionId2) {
    return sessionId1 < sessionId2 
        ? `${sessionId1}:${sessionId2}`
        : `${sessionId2}:${sessionId1}`;
}

/**
 * Check if pair was recently alerted
 */
function wasRecentlyAlerted(sessionId1, sessionId2) {
    const key = getPairKey(sessionId1, sessionId2);
    const lastAlert = recentAlerts.get(key);
    if (!lastAlert) return false;
    
    const cutoff = Date.now() - (PROXIMITY_ALERT_THROTTLE_SEC * 1000);
    return lastAlert > cutoff;
}

/**
 * Mark pair as alerted
 */
function markAlerted(sessionId1, sessionId2) {
    const key = getPairKey(sessionId1, sessionId2);
    recentAlerts.set(key, Date.now());
}

/**
 * Detect trucks too close to given truck using MongoDB geo query.
 * O(log n) with 2dsphere index instead of O(n²).
 * 
 * @param {string} sessionId - Session ID of truck to check
 * @param {number} latitude - Current latitude
 * @param {number} longitude - Current longitude
 * @param {number} proximityAlertM - Alert threshold in meters (default 10)
 * @returns {Promise<Array>} - Array of proximity alerts
 */
export async function detectTruckProximity(sessionId, latitude, longitude, proximityAlertM = DEFAULT_PROXIMITY_ALERT_M) {
    try {
        // Cleanup expired alerts periodically
        if (Math.random() < 0.1) {
            cleanupRecentAlerts();
        }
        
        // Find nearby active sessions using 2dsphere index
        const nearbyTrucks = await YardSession.findNearbyActive(
            longitude,
            latitude,
            proximityAlertM,
            sessionId
        );
        
        if (!nearbyTrucks || nearbyTrucks.length === 0) {
            return [];
        }
        
        const alerts = [];
        
        for (const nearbyTruck of nearbyTrucks) {
            // Skip if recently alerted for this pair
            if (wasRecentlyAlerted(sessionId, nearbyTruck.sessionId)) {
                continue;
            }
            
            // Calculate actual distance for alert details
            const distance = haversineDistance(
                latitude,
                longitude,
                nearbyTruck.lastLatitude,
                nearbyTruck.lastLongitude
            );
            
            // Create proximity alert
            const alert = {
                type: 'TRUCK_PROXIMITY',
                sessionId,
                nearbySessionId: nearbyTruck.sessionId,
                nearbyTruckId: nearbyTruck.truckId,
                distance: Math.round(distance * 100) / 100, // 2 decimal places
                thresholdM: proximityAlertM,
                timestamp: new Date(),
            };
            
            alerts.push(alert);
            markAlerted(sessionId, nearbyTruck.sessionId);
            
            // Log to EventLog (throttled in-memory)
            await EventLog.create({
                truckId: sessionId,
                eventType: 'TRUCK_PROXIMITY_ALERT',
                message: `Truck ${nearbyTruck.truckId} within ${Math.round(distance)}m`,
                timestamp: new Date(),
            });
        }
        
        return alerts;
        
    } catch (error) {
        console.error('Truck proximity detection failed:', error.message);
        return [];
    }
}

/**
 * Haversine distance calculation (meters)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
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

export default { detectTruckProximity };
