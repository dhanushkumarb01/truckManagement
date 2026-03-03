import mongoose from 'mongoose';

/**
 * YardSession Model
 * Tracks active truck sessions with production-safe fields.
 * 
 * Designed for:
 * - Atomic GPS updates with optimistic concurrency
 * - DB-backed zone tracking (no in-memory state)
 * - Safe horizontal scaling
 */
const yardSessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        truckId: {
            type: String,
            required: true,
            index: true,
        },
        vehicleNumber: {
            type: String,
            trim: true,
        },
        fastTagId: {
            type: String,
            sparse: true,
        },
        sessionStatus: {
            type: String,
            enum: ['ACTIVE', 'CLOSED', 'EXPIRED', 'CANCELLED'],
            default: 'ACTIVE',
            index: true,
        },
        startTime: {
            type: Date,
            default: Date.now,
        },
        endTime: {
            type: Date,
            default: null,
        },
        
        // ============ GPS CONCURRENCY FIELDS ============
        // Last GPS timestamp for atomic update validation
        lastGpsTimestamp: {
            type: Date,
            default: null,
        },
        lastLatitude: {
            type: Number,
            default: null,
        },
        lastLongitude: {
            type: Number,
            default: null,
        },
        // GeoJSON Point for 2dsphere proximity queries (Fix #4)
        lastLocation: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: [0, 0],
            },
        },
        
        // ============ ZONE TRACKING (DB-BACKED) ============
        // Replaces in-memory truckCurrentZones Map
        currentZoneId: {
            type: String,
            default: null,
        },
        currentZoneName: {
            type: String,
            default: null,
        },
        zoneEnteredAt: {
            type: Date,
            default: null,
        },
        lastZoneChangeTimestamp: {
            type: Date,
            default: null,
        },
        // For oscillation detection: count transitions in rolling window
        recentTransitionCount: {
            type: Number,
            default: 0,
        },
        lastTransitionCountReset: {
            type: Date,
            default: Date.now,
        },
        
        // ============ COUNTERS ============
        anomalyCount: {
            type: Number,
            default: 0,
        },
        proximityViolationCount: {
            type: Number,
            default: 0,
        },
        gpsEventCount: {
            type: Number,
            default: 0,
        },
        
        // Links to existing TruckSession for workflow compatibility
        truckSessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TruckSession',
        },
    },
    { 
        timestamps: true,
        // Enable optimistic concurrency via __v field
        optimisticConcurrency: true,
    }
);

// Compound index for session lookup
yardSessionSchema.index({ sessionStatus: 1, startTime: -1 });
yardSessionSchema.index({ truckId: 1, sessionStatus: 1 });
// 2dsphere index for proximity queries (Fix #4)
yardSessionSchema.index({ lastLocation: '2dsphere' });

/**
 * Static: Find active session by sessionId or truckId
 */
yardSessionSchema.statics.findActiveSession = function(identifier) {
    return this.findOne({
        $or: [
            { sessionId: identifier },
            { truckId: identifier }
        ],
        sessionStatus: 'ACTIVE',
    });
};

/**
 * Static: Find active session by vehicle
 */
yardSessionSchema.statics.findActiveByVehicle = function(vehicleNumber) {
    return this.findOne({
        vehicleNumber,
        sessionStatus: 'ACTIVE',
    });
};

/**
 * Static: Find nearby active sessions using 2dsphere (Fix #4)
 * @param {number} longitude - Center longitude
 * @param {number} latitude - Center latitude
 * @param {number} maxDistanceMeters - Max distance in meters
 * @param {string} excludeSessionId - Session ID to exclude (self)
 */
yardSessionSchema.statics.findNearbyActive = function(longitude, latitude, maxDistanceMeters, excludeSessionId) {
    return this.find({
        sessionStatus: 'ACTIVE',
        sessionId: { $ne: excludeSessionId },
        lastLocation: {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude]
                },
                $maxDistance: maxDistanceMeters
            }
        }
    }).select('sessionId truckId lastLatitude lastLongitude lastGpsTimestamp').lean();
};

/**
 * Static: Atomic GPS update with timestamp validation
 * Only updates if incoming timestamp > lastGpsTimestamp
 * Returns null if update was rejected (stale packet)
 */
yardSessionSchema.statics.atomicGpsUpdate = async function(sessionId, gpsData) {
    const { latitude, longitude, timestamp } = gpsData;
    const incomingTime = new Date(timestamp);
    
    const result = await this.findOneAndUpdate(
        {
            sessionId,
            sessionStatus: 'ACTIVE',
            $or: [
                { lastGpsTimestamp: null },
                { lastGpsTimestamp: { $lt: incomingTime } }
            ]
        },
        {
            $set: {
                lastGpsTimestamp: incomingTime,
                lastLatitude: latitude,
                lastLongitude: longitude,
                // Update GeoJSON location for proximity queries (Fix #4)
                lastLocation: {
                    type: 'Point',
                    coordinates: [longitude, latitude], // GeoJSON is [lng, lat]
                },
            },
            $inc: { gpsEventCount: 1 }
        },
        { new: true }
    );
    
    return result;
};

/**
 * Static: Atomic zone transition update
 * Updates zone tracking fields atomically
 */
yardSessionSchema.statics.atomicZoneUpdate = async function(sessionId, zoneData) {
    const { zoneId, zoneName, timestamp, isEnter } = zoneData;
    const now = new Date(timestamp);
    
    const updateOp = isEnter
        ? {
            $set: {
                currentZoneId: zoneId,
                currentZoneName: zoneName,
                zoneEnteredAt: now,
                lastZoneChangeTimestamp: now,
            },
            $inc: { recentTransitionCount: 1 }
        }
        : {
            $set: {
                currentZoneId: null,
                currentZoneName: null,
                zoneEnteredAt: null,
                lastZoneChangeTimestamp: now,
            },
            $inc: { recentTransitionCount: 1 }
        };
    
    return this.findOneAndUpdate(
        { sessionId, sessionStatus: 'ACTIVE' },
        updateOp,
        { new: true }
    );
};

/**
 * Static: Reset transition count if window expired (60s)
 */
yardSessionSchema.statics.checkAndResetTransitionCount = async function(sessionId) {
    const windowMs = 60000; // 60 seconds
    const cutoff = new Date(Date.now() - windowMs);
    
    return this.findOneAndUpdate(
        {
            sessionId,
            sessionStatus: 'ACTIVE',
            lastTransitionCountReset: { $lt: cutoff }
        },
        {
            $set: {
                recentTransitionCount: 0,
                lastTransitionCountReset: new Date()
            }
        },
        { new: true }
    );
};

/**
 * Static: Close session
 */
yardSessionSchema.statics.closeSession = function(sessionId) {
    return this.findOneAndUpdate(
        { sessionId, sessionStatus: 'ACTIVE' },
        { 
            $set: { 
                sessionStatus: 'CLOSED', 
                endTime: new Date() 
            } 
        },
        { new: true }
    );
};

const YardSession = mongoose.model('YardSession', yardSessionSchema);

export default YardSession;
