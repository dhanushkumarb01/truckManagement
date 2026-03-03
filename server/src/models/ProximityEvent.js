import mongoose from 'mongoose';

/**
 * ProximityEvent Collection
 * Stores BLE proximity violation events.
 * 
 * BLE beacons placed at key yard locations validate truck presence.
 * When RSSI signal is too weak or lost, a proximity violation is logged.
 * 
 * This is OPTIONAL - GPS tracking continues without BLE.
 * BLE provides additional validation layer for high-security zones.
 */
const proximityEventSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            index: true,
        },
        truckId: {
            type: String,
            required: true,
            index: true,
        },
        violationType: {
            type: String,
            enum: [
                'WEAK_SIGNAL',      // RSSI below threshold
                'SIGNAL_LOST',      // No BLE signal detected
                'BEACON_MISMATCH',  // Wrong beacon for current zone
                'UNEXPECTED_ZONE',  // In zone but no beacon signal expected
                'DWELL_EXCEEDED',   // Spent too long near beacon
            ],
            required: true,
        },
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'MEDIUM',
        },
        // BLE signal data
        bleDeviceId: {
            type: String,
            default: null,
        },
        bleSignalStrength: {
            type: Number, // RSSI in dBm (typically -30 to -100)
            default: null,
        },
        expectedBeaconId: {
            type: String,
            default: null,
        },
        // Location context
        latitude: {
            type: Number,
        },
        longitude: {
            type: Number,
        },
        currentZone: {
            type: String,
            default: null,
        },
        // Alert metadata
        acknowledged: {
            type: Boolean,
            default: false,
        },
        acknowledgedBy: {
            type: String,
            default: null,
        },
        acknowledgedAt: {
            type: Date,
            default: null,
        },
        notes: {
            type: String,
            default: null,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    { timestamps: true }
);

// Compound indexes for efficient querying
proximityEventSchema.index({ sessionId: 1, timestamp: -1 });
proximityEventSchema.index({ severity: 1, acknowledged: 1, timestamp: -1 });
proximityEventSchema.index({ violationType: 1, timestamp: -1 });
// Index for event throttling (Fix #5)
proximityEventSchema.index({ truckId: 1, violationType: 1, timestamp: -1 });

/**
 * Static method: Get recent unacknowledged violations
 */
proximityEventSchema.statics.getRecentViolations = function(limit = 50) {
    return this.find({ acknowledged: false })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

/**
 * Static method: Get violations for a session
 */
proximityEventSchema.statics.getSessionViolations = function(sessionId) {
    return this.find({ sessionId })
        .sort({ timestamp: -1 })
        .lean();
};

const ProximityEvent = mongoose.model('ProximityEvent', proximityEventSchema);

export default ProximityEvent;
