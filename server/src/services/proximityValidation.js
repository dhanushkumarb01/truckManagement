/**
 * BLE Proximity Validation Service
 * Validates BLE beacon proximity for high-security zones.
 * 
 * IMPORTANT: BLE is OPTIONAL. System continues to work without BLE data.
 * This provides an additional validation layer for critical zones.
 */

import ProximityEvent from '../models/ProximityEvent.js';

// ============ CONFIGURATION ============

/**
 * BLE proximity thresholds based on RSSI values.
 * RSSI is measured in dBm (negative values, closer to 0 = stronger signal).
 * 
 * Typical ranges:
 * -30 to -50 dBm: Immediate proximity (< 1m)
 * -50 to -70 dBm: Near (1-3m)
 * -70 to -90 dBm: Far (3-10m)
 * -90 to -100 dBm: Very far / Edge of range
 * < -100 dBm: Signal lost
 */
export const BLE_THRESHOLDS = {
    // Minimum acceptable RSSI for proximity validation
    MIN_RSSI: -85,
    
    // RSSI below this triggers WEAK_SIGNAL warning
    WEAK_SIGNAL_RSSI: -70,
    
    // RSSI below this triggers CRITICAL proximity violation
    CRITICAL_RSSI: -90,
    
    // Signal considered lost if below this
    SIGNAL_LOST_RSSI: -100,
};

/**
 * Zone-specific BLE requirements.
 * Maps zone types to their expected beacon behavior.
 */
export const ZONE_BLE_REQUIREMENTS = {
    'WEIGHBRIDGE': { required: true, expectedBeacon: true },
    'DOCK': { required: true, expectedBeacon: true },
    'RESTRICTED': { required: true, expectedBeacon: true },
    'ENTRY_GATE': { required: false, expectedBeacon: true },
    'EXIT_GATE': { required: false, expectedBeacon: true },
    'PARKING': { required: false, expectedBeacon: false },
    'CUSTOM': { required: false, expectedBeacon: false },
};

// ============ PROXIMITY STATUS ============

/**
 * Calculate proximity status from RSSI value.
 * 
 * @param {number|null} rssi - BLE signal strength in dBm
 * @returns {string} - Proximity status
 */
export function calculateProximityStatus(rssi) {
    if (rssi === null || rssi === undefined) {
        return 'NO_SIGNAL';
    }
    
    if (rssi >= -50) {
        return 'IMMEDIATE';
    } else if (rssi >= -70) {
        return 'NEAR';
    } else if (rssi >= -85) {
        return 'FAR';
    } else if (rssi >= -100) {
        return 'VERY_FAR';
    } else {
        return 'OUT_OF_RANGE';
    }
}

// ============ PROXIMITY VALIDATION ============

/**
 * Validate BLE proximity data and detect violations.
 * 
 * @param {Object} locationData - GPS + BLE location data
 * @param {Object} currentZone - Current zone object (can be null)
 * @returns {Promise<Object>} - Validation result with violations
 */
export async function validateProximity(locationData, currentZone = null) {
    const {
        truckId,
        sessionId,
        latitude,
        longitude,
        timestamp,
        bleSignalStrength,
        bleDeviceId,
    } = locationData;
    
    const effectiveSessionId = sessionId || truckId;
    
    const result = {
        truckId,
        sessionId: effectiveSessionId,
        proximityStatus: calculateProximityStatus(bleSignalStrength),
        bleSignalStrength,
        bleDeviceId,
        violations: [],
        hasViolation: false,
    };
    
    // If no BLE data provided, skip validation (BLE is optional)
    if (bleSignalStrength === null || bleSignalStrength === undefined) {
        // Check if zone requires BLE
        if (currentZone) {
            const zoneRequirement = ZONE_BLE_REQUIREMENTS[currentZone.zoneType];
            if (zoneRequirement?.required) {
                // Log warning but don't create violation yet
                // BLE enforcement is optional for now
                result.warning = `Zone ${currentZone.zoneName} requires BLE but no signal received`;
            }
        }
        return result;
    }
    
    // Validate signal strength
    if (bleSignalStrength < BLE_THRESHOLDS.SIGNAL_LOST_RSSI) {
        // Signal lost
        const violation = {
            sessionId: effectiveSessionId,
            truckId,
            violationType: 'SIGNAL_LOST',
            severity: 'HIGH',
            bleDeviceId,
            bleSignalStrength,
            latitude,
            longitude,
            currentZone: currentZone?.zoneName || null,
            timestamp: new Date(timestamp),
        };
        
        result.violations.push(violation);
        result.hasViolation = true;
        
    } else if (bleSignalStrength < BLE_THRESHOLDS.CRITICAL_RSSI) {
        // Critically weak signal
        const violation = {
            sessionId: effectiveSessionId,
            truckId,
            violationType: 'WEAK_SIGNAL',
            severity: 'HIGH',
            bleDeviceId,
            bleSignalStrength,
            latitude,
            longitude,
            currentZone: currentZone?.zoneName || null,
            timestamp: new Date(timestamp),
        };
        
        result.violations.push(violation);
        result.hasViolation = true;
        
    } else if (bleSignalStrength < BLE_THRESHOLDS.WEAK_SIGNAL_RSSI) {
        // Weak signal warning
        const violation = {
            sessionId: effectiveSessionId,
            truckId,
            violationType: 'WEAK_SIGNAL',
            severity: 'MEDIUM',
            bleDeviceId,
            bleSignalStrength,
            latitude,
            longitude,
            currentZone: currentZone?.zoneName || null,
            timestamp: new Date(timestamp),
        };
        
        result.violations.push(violation);
        result.hasViolation = true;
    }
    
    return result;
}

/**
 * Log proximity violations to database.
 * HARDENED: Includes event throttling to prevent flood (Fix #5)
 * 
 * @param {Array} violations - Array of violation objects
 * @param {number} throttleWindowSec - Throttle window in seconds (default 60)
 * @returns {Promise<Array>} - Created violation documents
 */
export async function logProximityViolations(violations, throttleWindowSec = 60) {
    if (!violations || violations.length === 0) {
        return [];
    }
    
    try {
        const throttledViolations = [];
        const throttleCutoff = new Date(Date.now() - throttleWindowSec * 1000);
        
        // Filter out throttled violations
        for (const violation of violations) {
            // Check if same violationType for same truckId exists within throttle window
            const recentExists = await ProximityEvent.findOne({
                truckId: violation.truckId,
                violationType: violation.violationType,
                timestamp: { $gte: throttleCutoff }
            }).lean();
            
            if (!recentExists) {
                throttledViolations.push(violation);
            } else {
                console.log(`⏭️ Throttled proximity ${violation.violationType} for ${violation.truckId}`);
            }
        }
        
        if (throttledViolations.length === 0) {
            return [];
        }
        
        const created = await ProximityEvent.insertMany(throttledViolations);
        console.log(`📡 Logged ${created.length} proximity violations (${violations.length - throttledViolations.length} throttled)`);
        return created;
    } catch (error) {
        console.error('Failed to log proximity violations:', error.message);
        return [];
    }
}

/**
 * Full proximity validation pipeline.
 * 
 * @param {Object} locationData - GPS + BLE location data
 * @param {Object} currentZone - Current zone (optional)
 * @returns {Promise<Object>} - Validation result
 */
export async function runProximityValidation(locationData, currentZone = null) {
    try {
        const result = await validateProximity(locationData, currentZone);
        
        if (result.violations.length > 0) {
            await logProximityViolations(result.violations);
        }
        
        return result;
    } catch (error) {
        console.error('Proximity validation failed:', error.message);
        return {
            truckId: locationData.truckId,
            sessionId: locationData.sessionId || locationData.truckId,
            proximityStatus: 'ERROR',
            violations: [],
            hasViolation: false,
            error: error.message,
        };
    }
}

/**
 * Get proximity status string for API response.
 * 
 * @param {number|null} rssi - BLE signal strength
 * @returns {string} - Human-readable status
 */
export function getProximityStatusLabel(rssi) {
    const status = calculateProximityStatus(rssi);
    
    const labels = {
        'IMMEDIATE': 'At beacon (< 1m)',
        'NEAR': 'Near beacon (1-3m)',
        'FAR': 'Far from beacon (3-10m)',
        'VERY_FAR': 'Edge of range (> 10m)',
        'OUT_OF_RANGE': 'Out of range',
        'NO_SIGNAL': 'No BLE signal',
    };
    
    return labels[status] || status;
}
