import mongoose from 'mongoose';

/**
 * YardConfig Model
 * Stores configurable yard parameters.
 * Replaces hardcoded values for production flexibility.
 */
const yardConfigSchema = new mongoose.Schema(
    {
        yardId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        yardName: {
            type: String,
            default: 'Default Yard',
        },
        
        // Geofence center point
        centerLat: {
            type: Number,
            required: true,
        },
        centerLng: {
            type: Number,
            required: true,
        },
        
        // Maximum distance from center (km)
        maxDistanceKm: {
            type: Number,
            default: 5,
        },
        
        // Speed thresholds
        maxSpeedKmh: {
            type: Number,
            default: 60,
        },
        
        // Anomaly detection
        maxTeleportDistanceM: {
            type: Number,
            default: 500,
        },
        maxAccuracyM: {
            type: Number,
            default: 100,
        },
        
        // Truck proximity alert distance (meters)
        truckProximityAlertM: {
            type: Number,
            default: 10,
        },
        
        // Event throttle window (seconds)
        eventThrottleWindowSec: {
            type: Number,
            default: 60,
        },
        
        // Oscillation detection
        oscillationWindowSec: {
            type: Number,
            default: 60,
        },
        oscillationThreshold: {
            type: Number,
            default: 5, // Max zone transitions in window before alert
        },
        
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

/**
 * Static: Get config for yard (with default fallback)
 */
yardConfigSchema.statics.getConfig = async function(yardId = 'DEFAULT_YARD') {
    let config = await this.findOne({ yardId, isActive: true });
    
    if (!config) {
        // Return default config object (not persisted)
        return {
            yardId: 'DEFAULT_YARD',
            yardName: 'Default Yard',
            centerLat: 28.2486,
            centerLng: 76.8110,
            maxDistanceKm: 5,
            maxSpeedKmh: 60,
            maxTeleportDistanceM: 500,
            maxAccuracyM: 100,
            truckProximityAlertM: 10,
            eventThrottleWindowSec: 60,
            oscillationWindowSec: 60,
            oscillationThreshold: 5,
            _isDefault: true,
        };
    }
    
    return config;
};

const YardConfig = mongoose.model('YardConfig', yardConfigSchema);

export default YardConfig;
