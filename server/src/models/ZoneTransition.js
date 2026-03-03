import mongoose from 'mongoose';

/**
 * ZoneTransition Collection
 * Logs zone entry and exit events for audit trail.
 * 
 * Created by backend when GPS location crosses zone boundaries.
 * Provides complete movement history within the yard.
 */
const zoneTransitionSchema = new mongoose.Schema(
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
        transitionType: {
            type: String,
            enum: ['ZONE_ENTER', 'ZONE_EXIT'],
            required: true,
        },
        zoneName: {
            type: String,
            required: true,
        },
        zoneId: {
            type: String,
            required: true,
        },
        zoneType: {
            type: String,
            default: null,
        },
        // Location at transition point
        latitude: {
            type: Number,
            required: true,
        },
        longitude: {
            type: Number,
            required: true,
        },
        // Previous zone (for ZONE_ENTER events)
        previousZone: {
            type: String,
            default: null,
        },
        // Duration in previous zone (for ZONE_EXIT events)
        dwellTime: {
            type: Number, // Seconds spent in zone
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

// Compound indexes
zoneTransitionSchema.index({ sessionId: 1, timestamp: -1 });
zoneTransitionSchema.index({ zoneId: 1, timestamp: -1 });
zoneTransitionSchema.index({ truckId: 1, transitionType: 1, timestamp: -1 });

/**
 * Static method: Get transitions for a session
 */
zoneTransitionSchema.statics.getSessionTransitions = function(sessionId) {
    return this.find({ sessionId })
        .sort({ timestamp: 1 })
        .lean();
};

/**
 * Static method: Get recent transitions across all sessions
 */
zoneTransitionSchema.statics.getRecentTransitions = function(limit = 100) {
    return this.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

const ZoneTransition = mongoose.model('ZoneTransition', zoneTransitionSchema);

export default ZoneTransition;
