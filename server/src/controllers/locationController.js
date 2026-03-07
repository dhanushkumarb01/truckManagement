import { asyncHandler } from '../middleware/errorHandler.js';
import GpsEvent from '../models/GpsEvent.js';
import EventLog from '../models/EventLog.js';
import AnomalyEvent from '../models/AnomalyEvent.js';

// ============ NEW MODULE IMPORTS ============
import { runAnomalyDetection } from '../services/anomalyDetection.js';
import { processZoneTransition, detectZone } from '../services/zoneDetection.js';
import { runProximityValidation, calculateProximityStatus } from '../services/proximityValidation.js';
import { detectTruckProximity } from '../services/truckProximity.js';
import YardSession from '../models/YardSession.js';
import TruckSession from '../models/TruckSession.js';
import YardConfig from '../models/YardConfig.js';

// ============ YARD CONFIG CACHE ============
// In-memory cache with 5-minute TTL (avoids DB hit on every GPS packet)
let yardConfigCache = null;
let yardConfigCacheTime = 0;
const YARD_CONFIG_CACHE_TTL = 300000; // 5 minutes

/**
 * Get yard config with caching.
 * Falls back to defaults if no config exists.
 */
async function getYardConfig(yardId = 'DEFAULT_YARD') {
    const now = Date.now();
    
    if (yardConfigCache && (now - yardConfigCacheTime) < YARD_CONFIG_CACHE_TTL) {
        return yardConfigCache;
    }
    
    try {
        yardConfigCache = await YardConfig.getConfig(yardId);
        yardConfigCacheTime = now;
        return yardConfigCache;
    } catch (error) {
        console.error('Failed to fetch yard config:', error.message);
        // Return cached or default
        return yardConfigCache || {
            maxSpeedKmh: 60,
            maxTeleportDistanceM: 500,
            maxAccuracyM: 100,
            eventThrottleWindowSec: 60,
        };
    }
}

/**
 * Validates the location payload.
 * Returns an array of error messages (empty if valid).
 * 
 * EXTENDED: Now accepts optional BLE data.
 */
function validateLocationPayload(body) {
    const errors = [];

    if (!body.truckId || typeof body.truckId !== 'string') {
        errors.push('truckId is required and must be a string');
    }

    if (typeof body.latitude !== 'number' || isNaN(body.latitude)) {
        errors.push('latitude is required and must be a number');
    }

    if (typeof body.longitude !== 'number' || isNaN(body.longitude)) {
        errors.push('longitude is required and must be a number');
    }

    if (typeof body.accuracy !== 'number' || isNaN(body.accuracy)) {
        errors.push('accuracy is required and must be a number');
    }

    if (!body.timestamp || typeof body.timestamp !== 'string') {
        errors.push('timestamp is required and must be a string');
    } else {
        // Validate ISO 8601 format
        const date = new Date(body.timestamp);
        if (isNaN(date.getTime())) {
            errors.push('timestamp must be a valid ISO 8601 date string');
        }
    }

    // Optional BLE validation
    if (body.bleSignalStrength !== undefined && body.bleSignalStrength !== null) {
        if (typeof body.bleSignalStrength !== 'number') {
            errors.push('bleSignalStrength must be a number (RSSI in dBm)');
        }
    }

    return errors;
}

/**
 * Validate session is active.
 * Supports both YardSession (FastTag) and TruckSession (legacy).
 * Also validates QR expiration for TruckSession.
 * 
 * @param {string} sessionId - Session/truck identifier
 * @returns {Promise<{ valid: boolean, sessionType: string, session?: Object, expired?: boolean }>}
 */
async function validateActiveSession(sessionId) {
    // Check YardSession first (FastTag-based)
    const yardSession = await YardSession.findActiveSession(sessionId);
    if (yardSession) {
        return { valid: true, sessionType: 'FASTAG', session: yardSession };
    }
    
    // Fallback to TruckSession (legacy UUID-based)
    const truckSession = await TruckSession.findOne({
        truckId: sessionId,
        state: { $ne: 'EXITED' },
    });
    
    if (truckSession) {
        // Check QR expiration
        if (truckSession.isQrExpired && truckSession.isQrExpired()) {
            return { valid: false, sessionType: 'LEGACY', session: truckSession, expired: true };
        }
        return { valid: true, sessionType: 'LEGACY', session: truckSession };
    }
    
    return { valid: false, sessionType: null, session: null };
}

/**
 * POST /api/location
 * Receives GPS location data from Android app.
 * 
 * EXTENDED with:
 * - Optional session validation (soft - logs warning but doesn't reject)
 * - Anomaly detection (speed, teleport, out-of-bounds)
 * - Zone transition detection
 * - BLE proximity validation (optional)
 * 
 * BACKWARD COMPATIBLE:
 * - Existing mobile flow continues to work
 * - Session validation is optional (doesn't reject)
 * - BLE is optional
 */
export const receiveLocation = asyncHandler(async (req, res) => {
    console.log("🔥 HIT PRODUCTION BACKEND");
    console.log("Incoming Body:", req.body);

    const { 
        truckId, 
        latitude, 
        longitude, 
        accuracy, 
        timestamp,
        // Optional new fields
        sessionId: providedSessionId,
        bleSignalStrength,
        bleDeviceId,
    } = req.body;

    // Validate payload
    const validationErrors = validateLocationPayload(req.body);
    if (validationErrors.length > 0) {
        console.log("❌ Validation failed:", validationErrors);

        return res.status(400).json({
            success: false,
            data: null,
            message: validationErrors.join('; '),
        });
    }

    // Determine sessionId (prefer explicit, fallback to truckId)
    const effectiveSessionId = providedSessionId || truckId;

    // Session validation (soft - log warning but don't reject)
    // This maintains backward compatibility with existing mobile flow
    const sessionValidation = await validateActiveSession(effectiveSessionId);
    if (!sessionValidation.valid) {
        // Check if QR expired (Issue #3)
        if (sessionValidation.expired) {
            console.log(`⏰ QR expired for ${effectiveSessionId} - rejecting GPS`);
            return res.status(401).json({
                success: false,
                data: null,
                expired: true,
                message: 'Session QR code has expired. Please generate a new QR code.',
            });
        }
        
        console.log(`❌ No active session for ${effectiveSessionId} - rejecting GPS`);
        // HARDENED: Reject GPS if no active session (Fix #2)
        return res.status(409).json({
            success: false,
            data: null,
            message: 'No active session found. Please start a session first.',
        });
    }

    try {
        // Get yard config (cached)
        const yardConfig = await getYardConfig();
        
        // Prepare location data object for processing
        const locationData = {
            truckId,
            sessionId: effectiveSessionId,
            latitude,
            longitude,
            accuracy,
            timestamp,
            bleSignalStrength: bleSignalStrength ?? null,
            bleDeviceId: bleDeviceId ?? null,
        };

        // ============ YARD BOUNDARY VALIDATION (Fix #5) ============
        // Check if GPS point is inside yard boundary (circle or polygon)
        const isInsideYard = YardConfig.isPointInsideBoundary(yardConfig, latitude, longitude);
        if (!isInsideYard) {
            console.log(`🚨 OUT_OF_YARD: Truck ${truckId} at (${latitude}, ${longitude}) is outside yard boundary`);
            
            // Create OUT_OF_YARD event log
            await EventLog.create({
                sessionId: effectiveSessionId,
                truckId,
                eventType: 'OUT_OF_YARD',
                severity: 'high',
                message: `Truck ${truckId} detected outside yard boundary at coordinates (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
                metadata: {
                    latitude,
                    longitude,
                    boundaryType: yardConfig.boundaryType || 'circle',
                    timestamp: new Date(timestamp),
                },
            });
            
            // Also create AnomalyEvent for anomaly dashboard alignment
            await AnomalyEvent.create({
                sessionId: effectiveSessionId,
                truckId,
                anomalyType: 'OUT_OF_BOUNDS',
                severity: 'HIGH',
                latitude,
                longitude,
                accuracy: accuracy || null,
                timestamp: new Date(timestamp),
                notes: `Truck outside yard boundary at (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`,
            });
        }

        // ============ ATOMIC SESSION UPDATE (Fix #1) ============
        // Use atomic update with timestamp validation to prevent race conditions
        // Only updates if incoming timestamp > lastGpsTimestamp
        if (sessionValidation.sessionType === 'FASTAG') {
            const atomicResult = await YardSession.atomicGpsUpdate(effectiveSessionId, {
                latitude,
                longitude,
                timestamp,
            });
            
            if (!atomicResult) {
                // Stale packet - newer data already processed
                console.log(`⏭️ Stale GPS packet for ${truckId} - skipping`);
                return res.status(200).json({
                    success: true,
                    data: { skipped: true },
                    message: 'Stale GPS packet ignored (newer data already received)',
                });
            }
        }

        // ============ RUN ANOMALY DETECTION ============
        // Runs BEFORE saving to detect spoofing/teleportation
        // Does NOT reject - just logs anomalies
        const anomalies = await runAnomalyDetection(locationData, yardConfig);
        if (anomalies.length > 0) {
            console.log(`⚠️ Detected ${anomalies.length} anomalies for ${truckId}`);
            
            // Update session anomaly count if using FastTag
            if (sessionValidation.sessionType === 'FASTAG') {
                await YardSession.updateOne(
                    { sessionId: effectiveSessionId },
                    { $inc: { anomalyCount: anomalies.length } }
                );
            }
        }

        // ============ SAVE GPS EVENT ============
        // Save AFTER anomaly detection to maintain audit trail
        const gpsEvent = await GpsEvent.create({
            truckId,
            latitude,
            longitude,
            accuracy,
            timestamp: new Date(timestamp),
            eventType: 'GPS_UPDATE',
        });

        console.log("✅ Saved to MongoDB with ID:", gpsEvent._id);

        // ============ PROCESS ZONE TRANSITION ============
        // Runs AFTER saving to detect zone enter/exit
        const zoneResult = await processZoneTransition(locationData);
        const currentZone = zoneResult.currentZone;

        // ============ RUN BLE PROXIMITY VALIDATION ============
        // Optional - only if BLE data provided
        let proximityResult = null;
        if (bleSignalStrength !== undefined && bleSignalStrength !== null) {
            const zone = await detectZone(latitude, longitude);
            proximityResult = await runProximityValidation(locationData, zone);
            
            if (proximityResult.hasViolation) {
                console.log(`📡 Proximity violation for ${truckId}`);
                
                // Update session proximity violation count if using FastTag
                if (sessionValidation.sessionType === 'FASTAG') {
                    await YardSession.updateOne(
                        { sessionId: effectiveSessionId },
                        { $inc: { proximityViolationCount: proximityResult.violations.length } }
                    );
                }
            }
        }

        // ============ TRUCK-TO-TRUCK PROXIMITY CHECK (Fix #4) ============
        // Uses optimized MongoDB 2dsphere query instead of O(n²)
        let truckProximityAlerts = [];
        if (sessionValidation.sessionType === 'FASTAG') {
            const proximityThreshold = yardConfig.truckProximityAlertM || 10;
            truckProximityAlerts = await detectTruckProximity(
                effectiveSessionId,
                latitude,
                longitude,
                proximityThreshold
            );
            
            if (truckProximityAlerts.length > 0) {
                console.log(`🚛 ${truckProximityAlerts.length} truck proximity alerts for ${truckId}`);
            }
        }

        // ============ BUILD RESPONSE ============
        const response = {
            success: true,
            data: {
                gpsEvent,
                sessionId: effectiveSessionId,
                sessionType: sessionValidation.sessionType || 'UNKNOWN',
                currentZone: currentZone || null,
                isInsideYard,
                zoneTransitions: zoneResult.transitions.length > 0 
                    ? zoneResult.transitions.map(t => ({
                        type: t.transitionType,
                        zone: t.zoneName,
                    }))
                    : null,
                anomalyCount: anomalies.length,
                proximityStatus: proximityResult 
                    ? proximityResult.proximityStatus 
                    : calculateProximityStatus(bleSignalStrength),
                truckProximityAlerts: truckProximityAlerts.length > 0 ? truckProximityAlerts : null,
            },
            message: 'Location received successfully',
        };

        // Add warnings if any issues detected
        const warnings = [];
        if (!isInsideYard) {
            warnings.push('Truck is outside yard boundary');
        }
        if (anomalies.length > 0) {
            warnings.push(`${anomalies.length} anomalies detected`);
        }
        if (proximityResult?.hasViolation) {
            warnings.push('Proximity violation detected');
        }
        if (truckProximityAlerts.length > 0) {
            warnings.push(`${truckProximityAlerts.length} trucks nearby`);
        }
        
        if (warnings.length > 0) {
            response.warnings = warnings;
        }

        res.status(201).json(response);

    } catch (error) {
        console.error("❌ Location Processing Error:", error);

        res.status(500).json({
            success: false,
            data: null,
            message: "Location processing failed",
        });
    }
});


/**
 * GET /api/events
 * Returns all GPS event logs, sorted by latest first.
 */
export const getGpsEvents = asyncHandler(async (req, res) => {
    // Fetch from MongoDB, sorted by timestamp descending
    const events = await GpsEvent.find()
        .sort({ timestamp: -1 })
        .lean();

    res.json({
        success: true,
        data: events,
        message: `${events.length} GPS event(s) found`,
    });
});
