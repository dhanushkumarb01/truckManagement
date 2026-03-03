/**
 * Zone Detection Service
 * Handles zone transitions and logging for GPS events.
 * 
 * HARDENED: Uses DB-backed state instead of in-memory (Fix #3)
 * - Supports server restarts
 * - Supports horizontal scaling
 */

import Zone from '../models/Zone.js';
import ZoneTransition from '../models/ZoneTransition.js';
import EventLog from '../models/EventLog.js';
import YardSession from '../models/YardSession.js';

// In-memory cache for active zones (refresh periodically)
let zonesCache = null;
let zonesCacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Point-in-polygon detection using ray casting algorithm.
 * Works with GeoJSON coordinates [lng, lat] format.
 * 
 * @param {number} lat - Latitude of point
 * @param {number} lng - Longitude of point
 * @param {Array} polygon - Array of [lng, lat] coordinates
 * @returns {boolean}
 */
function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = polygon[i]; // GeoJSON is [lng, lat]
        const [xj, yj] = polygon[j];
        
        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Get active zones from database (with caching).
 * 
 * @param {string} yardId - Yard identifier
 * @returns {Promise<Array>} - Array of zone documents
 */
export async function getActiveZones(yardId = 'DEFAULT_YARD') {
    const now = Date.now();
    
    // Return cached zones if still valid
    if (zonesCache && (now - zonesCacheTime) < CACHE_TTL) {
        return zonesCache;
    }
    
    try {
        zonesCache = await Zone.findActiveZones(yardId);
        zonesCacheTime = now;
        return zonesCache;
    } catch (error) {
        console.error('Failed to fetch zones:', error.message);
        return zonesCache || [];
    }
}

/**
 * Invalidate zones cache.
 * Call this when zones are created/updated/deleted.
 */
export function invalidateZonesCache() {
    zonesCache = null;
    zonesCacheTime = 0;
}

/**
 * Detect which zone a point is in.
 * Uses in-memory polygon checking for performance.
 * 
 * @param {number} latitude - Point latitude
 * @param {number} longitude - Point longitude
 * @param {string} yardId - Yard identifier
 * @returns {Promise<Object|null>} - Zone object or null
 */
export async function detectZone(latitude, longitude, yardId = 'DEFAULT_YARD') {
    const zones = await getActiveZones(yardId);
    
    for (const zone of zones) {
        if (!zone.geoJsonPolygon?.coordinates?.[0]) {
            continue;
        }
        
        const polygon = zone.geoJsonPolygon.coordinates[0];
        
        if (pointInPolygon(latitude, longitude, polygon)) {
            return zone;
        }
    }
    
    return null;
}

/**
 * Detect all zones containing a point (for overlapping zones).
 * 
 * @param {number} latitude - Point latitude
 * @param {number} longitude - Point longitude
 * @param {string} yardId - Yard identifier
 * @returns {Promise<Array>} - Array of zone objects
 */
export async function detectAllZones(latitude, longitude, yardId = 'DEFAULT_YARD') {
    const zones = await getActiveZones(yardId);
    const containingZones = [];
    
    for (const zone of zones) {
        if (!zone.geoJsonPolygon?.coordinates?.[0]) {
            continue;
        }
        
        const polygon = zone.geoJsonPolygon.coordinates[0];
        
        if (pointInPolygon(latitude, longitude, polygon)) {
            containingZones.push(zone);
        }
    }
    
    return containingZones;
}

/**
 * Process zone transition for a truck location update.
 * HARDENED: Uses DB-backed state via YardSession (Fix #3)
 * 
 * @param {Object} locationData - GPS location data
 * @returns {Promise<Object>} - Transition result
 */
export async function processZoneTransition(locationData) {
    const {
        truckId,
        sessionId,
        latitude,
        longitude,
        timestamp
    } = locationData;
    
    const effectiveSessionId = sessionId || truckId;
    
    // Get current zone state from DB (not in-memory)
    const session = await YardSession.findActiveSession(effectiveSessionId);
    const previousZoneId = session?.currentZoneId || null;
    const previousZoneName = session?.currentZoneName || null;
    const previousZoneEnterTime = session?.zoneEnteredAt || null;
    
    // Detect new zone
    const currentZone = await detectZone(latitude, longitude);
    
    const result = {
        truckId,
        sessionId: effectiveSessionId,
        previousZone: previousZoneName,
        currentZone: currentZone?.zoneName || null,
        transitions: [],
    };
    
    // Check for zone change
    const currentZoneId = currentZone?.zoneId || null;
    
    if (previousZoneId !== currentZoneId) {
        const eventTimestamp = new Date(timestamp);
        
        // Zone exit event
        if (previousZoneId) {
            const dwellTime = previousZoneEnterTime 
                ? Math.round((eventTimestamp - new Date(previousZoneEnterTime)) / 1000)
                : null;
            
            const exitTransition = await ZoneTransition.create({
                sessionId: effectiveSessionId,
                truckId,
                transitionType: 'ZONE_EXIT',
                zoneName: previousZoneName,
                zoneId: previousZoneId,
                latitude,
                longitude,
                dwellTime,
                timestamp: eventTimestamp,
            });
            
            result.transitions.push(exitTransition);
            
            // Also log to EventLog for compatibility
            await EventLog.create({
                truckId,
                eventType: 'ZONE_EXIT',
                message: `Exited ${previousZoneName} (${dwellTime || '?'}s dwell time)`,
                timestamp: eventTimestamp,
            });
            
            console.log(`🚪 ${truckId} exited ${previousZoneName}`);
        }
        
        // Zone enter event
        if (currentZone) {
            const enterTransition = await ZoneTransition.create({
                sessionId: effectiveSessionId,
                truckId,
                transitionType: 'ZONE_ENTER',
                zoneName: currentZone.zoneName,
                zoneId: currentZone.zoneId,
                zoneType: currentZone.zoneType,
                latitude,
                longitude,
                previousZone: previousZoneName || 'OUTSIDE',
                timestamp: eventTimestamp,
            });
            
            result.transitions.push(enterTransition);
            
            // Also log to EventLog for compatibility
            await EventLog.create({
                truckId,
                eventType: 'ZONE_ENTER',
                message: `Entered ${currentZone.zoneName}`,
                timestamp: eventTimestamp,
            });
            
            console.log(`📍 ${truckId} entered ${currentZone.zoneName}`);
        }
        
        // Update session zone state atomically in DB (not in-memory)
        if (session) {
            await YardSession.atomicZoneUpdate(effectiveSessionId, {
                zoneId: currentZoneId,
                zoneName: currentZone?.zoneName || null,
                timestamp: eventTimestamp,
                isEnter: !!currentZone,
            });
        }
    }
    
    return result;
}

/**
 * Get current zone for a truck from DB.
 * HARDENED: Uses DB instead of in-memory Map (Fix #3)
 * 
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object|null>} - Current zone data or null
 */
export async function getTruckCurrentZone(sessionId) {
    const session = await YardSession.findActiveSession(sessionId);
    if (!session || !session.currentZoneId) {
        return null;
    }
    return {
        zoneId: session.currentZoneId,
        zoneName: session.currentZoneName,
        enteredAt: session.zoneEnteredAt,
    };
}

/**
 * Get all trucks' current zones from DB.
 * HARDENED: Uses DB query instead of in-memory Map (Fix #3)
 * 
 * @returns {Promise<Object>} - Map of sessionId to zone name
 */
export async function getAllTruckZones() {
    const sessions = await YardSession.find({
        sessionStatus: 'ACTIVE',
        currentZoneId: { $ne: null }
    }).select('sessionId currentZoneName').lean();
    
    const result = {};
    for (const session of sessions) {
        result[session.sessionId] = session.currentZoneName;
    }
    return result;
}

/**
 * Clear zone state for a session (e.g., on session end).
 * HARDENED: Uses DB update instead of Map.delete (Fix #3)
 * 
 * @param {string} sessionId - Session identifier
 */
export async function clearTruckZone(sessionId) {
    await YardSession.updateOne(
        { sessionId },
        { 
            $set: { 
                currentZoneId: null, 
                currentZoneName: null, 
                zoneEnteredAt: null 
            } 
        }
    );
}
