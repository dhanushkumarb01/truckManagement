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
        
        // Maximum distance from center (km) - used when boundaryType is 'circle'
        maxDistanceKm: {
            type: Number,
            default: 5,
        },
        
        // Boundary type: 'circle' (center + radius) or 'polygon' (array of coordinates)
        boundaryType: {
            type: String,
            enum: ['circle', 'polygon'],
            default: 'circle',
        },
        
        // Polygon boundary coordinates (used when boundaryType is 'polygon')
        // Array of {lat, lng} points defining the yard perimeter
        boundaryPolygon: [{
            lat: { type: Number, required: true },
            lng: { type: Number, required: true },
        }],
        
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
            boundaryType: 'circle',
            boundaryPolygon: [],
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

/**
 * Static: Check if a GPS point is inside the yard boundary
 * Supports both circle and polygon boundary types
 * @param {Object} config - Yard configuration
 * @param {number} lat - Latitude to check
 * @param {number} lng - Longitude to check
 * @returns {boolean} - True if point is inside boundary
 */
yardConfigSchema.statics.isPointInsideBoundary = function(config, lat, lng) {
    if (!config) return true; // No config = allow all
    
    if (config.boundaryType === 'polygon' && config.boundaryPolygon?.length >= 3) {
        // Use ray-casting algorithm for polygon
        return isPointInPolygon(lat, lng, config.boundaryPolygon);
    } else {
        // Default to circle boundary check
        const distanceKm = haversineDistance(
            config.centerLat,
            config.centerLng,
            lat,
            lng
        );
        return distanceKm <= (config.maxDistanceKm || 5);
    }
};

/**
 * Ray-casting algorithm to determine if point is inside polygon
 * @param {number} lat - Point latitude
 * @param {number} lng - Point longitude  
 * @param {Array} polygon - Array of {lat, lng} vertices
 * @returns {boolean} - True if point is inside polygon
 */
function isPointInPolygon(lat, lng, polygon) {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i].lat;
        const yi = polygon[i].lng;
        const xj = polygon[j].lat;
        const yj = polygon[j].lng;
        
        const intersect = ((yi > lng) !== (yj > lng))
            && (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    
    return inside;
}

/**
 * Haversine formula to calculate distance between two GPS points
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) {
    return deg * (Math.PI / 180);
}

const YardConfig = mongoose.model('YardConfig', yardConfigSchema);

export default YardConfig;
