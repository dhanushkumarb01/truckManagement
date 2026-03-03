import mongoose from 'mongoose';

/**
 * Zone Collection
 * Stores arbitrary-shaped geofence zones created by yard managers.
 * 
 * GeoJSON polygon format is used for MongoDB geospatial queries.
 * The coordinates are stored in GeoJSON standard: [longitude, latitude].
 * 
 * NOTE: Frontend Leaflet uses [lat, lng], so conversion is needed.
 */
const zoneSchema = new mongoose.Schema(
    {
        zoneId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        zoneName: {
            type: String,
            required: true,
            trim: true,
        },
        zoneType: {
            type: String,
            enum: [
                'ENTRY_GATE',
                'EXIT_GATE',
                'WEIGHBRIDGE',
                'DOCK',
                'PARKING',
                'RESTRICTED',
                'LOADING',
                'UNLOADING',
                'INSPECTION',
                'CUSTOM'
            ],
            default: 'CUSTOM',
        },
        // GeoJSON Polygon format for MongoDB geospatial queries
        geoJsonPolygon: {
            type: {
                type: String,
                enum: ['Polygon'],
                default: 'Polygon',
            },
            coordinates: {
                type: [[[Number]]], // Array of linear rings, each ring is array of [lng, lat] pairs
                default: undefined, // Populated by pre-save hook from leafletCoordinates
            },
        },
        // Leaflet-friendly coordinates [lat, lng] for frontend rendering
        leafletCoordinates: {
            type: [[Number]], // Array of [lat, lng] pairs
            required: true,
        },
        yardId: {
            type: String,
            default: 'DEFAULT_YARD',
            index: true,
        },
        color: {
            type: String,
            default: '#3b82f6', // Blue default
        },
        fillOpacity: {
            type: Number,
            default: 0.15,
            min: 0,
            max: 1,
        },
        // Zone rules/constraints
        rules: {
            maxDwellTime: {
                type: Number, // Minutes - alert if truck stays longer
                default: null,
            },
            requiredForWorkflow: {
                type: Boolean, // True if truck must visit this zone
                default: false,
            },
            sequenceOrder: {
                type: Number, // Order in which zones should be visited
                default: null,
            },
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: String,
            default: 'system',
        },
    },
    { timestamps: true }
);

// 2dsphere index for geospatial queries
zoneSchema.index({ geoJsonPolygon: '2dsphere' });
zoneSchema.index({ yardId: 1, isActive: 1 });

/**
 * Static method: Find all active zones for a yard
 */
zoneSchema.statics.findActiveZones = function(yardId = 'DEFAULT_YARD') {
    return this.find({ 
        yardId, 
        isActive: true 
    }).sort({ createdAt: 1 });
};

/**
 * Static method: Find zone containing a point
 * Uses MongoDB geospatial query
 */
zoneSchema.statics.findZoneForPoint = async function(latitude, longitude, yardId = 'DEFAULT_YARD') {
    return this.findOne({
        yardId,
        isActive: true,
        geoJsonPolygon: {
            $geoIntersects: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude], // GeoJSON is [lng, lat]
                }
            }
        }
    });
};

/**
 * Static method: Find all zones containing a point
 */
zoneSchema.statics.findAllZonesForPoint = async function(latitude, longitude, yardId = 'DEFAULT_YARD') {
    return this.find({
        yardId,
        isActive: true,
        geoJsonPolygon: {
            $geoIntersects: {
                $geometry: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                }
            }
        }
    });
};

/**
 * Pre-validate hook: Convert leaflet coordinates to GeoJSON format BEFORE validation
 * This ensures geoJsonPolygon is populated before schema validation runs
 */
zoneSchema.pre('validate', function(next) {
    if (this.leafletCoordinates && this.leafletCoordinates.length >= 3) {
        // Convert [lat, lng] to GeoJSON [lng, lat] format
        const geoCoords = this.leafletCoordinates.map(([lat, lng]) => [lng, lat]);
        
        // Close the ring if not already closed
        const first = geoCoords[0];
        const last = geoCoords[geoCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            geoCoords.push([...first]);
        }
        
        this.geoJsonPolygon = {
            type: 'Polygon',
            coordinates: [geoCoords], // Single ring polygon
        };
    }
    next();
});

/**
 * Pre-save hook: Convert leaflet coordinates to GeoJSON format
 */
zoneSchema.pre('save', function(next) {
    if (this.isModified('leafletCoordinates')) {
        // Convert [lat, lng] to GeoJSON [lng, lat] format
        // GeoJSON polygon requires closing the ring (first point = last point)
        const geoCoords = this.leafletCoordinates.map(([lat, lng]) => [lng, lat]);
        
        // Close the ring if not already closed
        const first = geoCoords[0];
        const last = geoCoords[geoCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            geoCoords.push([...first]);
        }
        
        this.geoJsonPolygon = {
            type: 'Polygon',
            coordinates: [geoCoords], // Single ring polygon
        };
    }
    next();
});

const Zone = mongoose.model('Zone', zoneSchema);

export default Zone;
