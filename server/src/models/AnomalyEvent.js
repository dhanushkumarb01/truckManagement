import mongoose from 'mongoose';

/**
 * AnomalyEvent Collection
 * Stores coordinate anomaly events detected during GPS tracking.
 * 
 * Detects:
 * - Unrealistic speed (GPS spoofing indicator)
 * - Teleportation (sudden large jumps)
 * - Out of bounds (outside yard perimeter)
 * - Stationary timeout (no movement for too long)
 * 
 * IMPORTANT: Anomalies are logged but do NOT reject location data.
 * This allows audit trail while maintaining continuous tracking.
 */
const anomalyEventSchema = new mongoose.Schema(
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
        anomalyType: {
            type: String,
            enum: [
                'SPEED_VIOLATION',    // Speed exceeds threshold
                'TELEPORT',           // Distance jump without time correlation
                'OUT_OF_BOUNDS',      // Outside yard boundary
                'ACCURACY_POOR',      // GPS accuracy too low
                'TIMESTAMP_ANOMALY',  // Future timestamp or large gap
                'DUPLICATE_LOCATION', // Same exact coordinates repeated
                'STATIONARY_TIMEOUT', // No movement for extended period
            ],
            required: true,
        },
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'MEDIUM',
        },
        // Calculated metrics that triggered anomaly
        calculatedSpeed: {
            type: Number, // km/h
            default: null,
        },
        distance: {
            type: Number, // meters
            default: null,
        },
        timeDelta: {
            type: Number, // seconds
            default: null,
        },
        // Current location data
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
        accuracy: {
            type: Number,
            default: null,
        },
        // Previous location data (for comparison)
        previousLatitude: {
            type: Number,
            default: null,
        },
        previousLongitude: {
            type: Number,
            default: null,
        },
        // Threshold values used for detection (for audit)
        thresholdUsed: {
            speedThreshold: { type: Number, default: null }, // km/h
            distanceThreshold: { type: Number, default: null }, // meters
            accuracyThreshold: { type: Number, default: null }, // meters
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
        // Auto-resolved if subsequent data is normal
        autoResolved: {
            type: Boolean,
            default: false,
        },
        autoResolvedAt: {
            type: Date,
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
anomalyEventSchema.index({ sessionId: 1, timestamp: -1 });
anomalyEventSchema.index({ anomalyType: 1, severity: 1, timestamp: -1 });
anomalyEventSchema.index({ acknowledged: 1, autoResolved: 1, timestamp: -1 });
anomalyEventSchema.index({ truckId: 1, timestamp: -1 });
// Index for event throttling (Fix #5)
anomalyEventSchema.index({ truckId: 1, anomalyType: 1, timestamp: -1 });

/**
 * Static method: Get recent unresolved anomalies
 */
anomalyEventSchema.statics.getRecentAnomalies = function(limit = 50) {
    return this.find({ 
        acknowledged: false,
        autoResolved: false 
    })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

/**
 * Static method: Get anomalies for a session
 */
anomalyEventSchema.statics.getSessionAnomalies = function(sessionId) {
    return this.find({ sessionId })
        .sort({ timestamp: -1 })
        .lean();
};

/**
 * Static method: Get anomaly statistics
 */
anomalyEventSchema.statics.getAnomalyStats = async function(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return this.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { 
            $group: {
                _id: '$anomalyType',
                count: { $sum: 1 },
                avgSpeed: { $avg: '$calculatedSpeed' },
                avgDistance: { $avg: '$distance' },
            }
        },
        { $sort: { count: -1 } }
    ]);
};

const AnomalyEvent = mongoose.model('AnomalyEvent', anomalyEventSchema);

export default AnomalyEvent;
