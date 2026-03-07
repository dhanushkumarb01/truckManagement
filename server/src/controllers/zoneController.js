/**
 * Zone Controller
 * CRUD operations for yard zones (geofences).
 * 
 * Zones are stored with GeoJSON polygons for spatial queries.
 * Frontend sends Leaflet coordinates [lat, lng], backend converts to GeoJSON [lng, lat].
 */

import { asyncHandler } from '../middleware/errorHandler.js';
import Zone from '../models/Zone.js';
import { invalidateZonesCache } from '../services/zoneDetection.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/zones
 * Create a new zone.
 * 
 * Input:
 * - zoneName: Display name
 * - zoneType: Category (DOCK, WEIGHBRIDGE, etc.)
 * - coordinates: Array of [lat, lng] points (Leaflet format)
 * - color: (optional) Display color
 * - yardId: (optional) Yard identifier
 */
export const createZone = asyncHandler(async (req, res) => {
    const {
        zoneName,
        zoneType,
        coordinates,
        color,
        fillOpacity,
        yardId,
        rules,
        createdBy,
    } = req.body;
    
    // Validate required fields
    if (!zoneName || typeof zoneName !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'zoneName is required',
        });
    }
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'At least 3 coordinate points are required to form a polygon',
        });
    }
    
    // Validate coordinate format
    for (const coord of coordinates) {
        if (!Array.isArray(coord) || coord.length !== 2 ||
            typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Each coordinate must be [latitude, longitude] pair',
            });
        }
    }
    
    // Check for duplicate zone name in yard
    const existingZone = await Zone.findOne({
        zoneName: zoneName.trim(),
        yardId: yardId || 'DEFAULT_YARD',
        isActive: true,
    });
    
    if (existingZone) {
        return res.status(409).json({
            success: false,
            data: null,
            message: `Zone "${zoneName}" already exists in this yard`,
        });
    }
    
    // Create zone (pre-save hook converts coordinates to GeoJSON)
    const zone = await Zone.create({
        zoneId: uuidv4(),
        zoneName: zoneName.trim(),
        zoneType: zoneType || 'CUSTOM',
        leafletCoordinates: coordinates,
        color: color || '#3b82f6',
        fillOpacity: fillOpacity || 0.15,
        yardId: yardId || 'DEFAULT_YARD',
        rules: rules || {},
        createdBy: createdBy || 'system',
        isActive: true,
    });
    
    // Invalidate cache
    invalidateZonesCache();
    
    console.log(`✅ Created zone: ${zone.zoneName} (${zone.zoneId})`);
    
    res.status(201).json({
        success: true,
        data: zone,
        message: 'Zone created successfully',
    });
});

/**
 * GET /api/zones
 * List all zones (optionally filtered by yardId).
 */
export const getZones = asyncHandler(async (req, res) => {
    const { yardId, includeInactive } = req.query;
    
    const query = {
        yardId: yardId || 'DEFAULT_YARD',
    };
    
    if (!includeInactive) {
        query.isActive = true;
    }
    
    const zones = await Zone.find(query)
        .sort({ createdAt: 1 })
        .lean();
    
    // Transform for frontend (use leafletCoordinates directly)
    const formatted = zones.map(zone => ({
        ...zone,
        coordinates: zone.leafletCoordinates, // [lat, lng] format for Leaflet
    }));
    
    res.status(200).json({
        success: true,
        data: formatted,
        message: `Found ${zones.length} zones`,
    });
});

/**
 * GET /api/zones/:zoneId
 * Get a specific zone by ID.
 */
export const getZone = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    
    const zone = await Zone.findOne({ zoneId });
    
    if (!zone) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Zone not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: {
            ...zone.toObject(),
            coordinates: zone.leafletCoordinates,
        },
        message: 'Zone found',
    });
});

/**
 * PUT /api/zones/:zoneId
 * Update zone details.
 */
export const updateZone = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    const updates = req.body;
    
    // Prevent changing zoneId
    delete updates.zoneId;
    
    // Find zone
    const zone = await Zone.findOne({ zoneId });
    
    if (!zone) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Zone not found',
        });
    }
    
    // Update leafletCoordinates if coordinates provided
    if (updates.coordinates) {
        if (!Array.isArray(updates.coordinates) || updates.coordinates.length < 3) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'At least 3 coordinate points are required',
            });
        }
        zone.leafletCoordinates = updates.coordinates;
        delete updates.coordinates;
    }
    
    // Apply other updates
    Object.assign(zone, updates);
    await zone.save();
    
    // Invalidate cache
    invalidateZonesCache();
    
    console.log(`📝 Updated zone: ${zone.zoneName}`);
    
    res.status(200).json({
        success: true,
        data: {
            ...zone.toObject(),
            coordinates: zone.leafletCoordinates,
        },
        message: 'Zone updated successfully',
    });
});

/**
 * DELETE /api/zones/:zoneId
 * Soft-delete a zone (set isActive = false).
 */
export const deleteZone = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    
    const zone = await Zone.findOneAndUpdate(
        { zoneId },
        { isActive: false },
        { new: true }
    );
    
    if (!zone) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Zone not found',
        });
    }
    
    // Invalidate cache
    invalidateZonesCache();
    
    console.log(`🗑️ Deleted zone: ${zone.zoneName}`);
    
    res.status(200).json({
        success: true,
        data: zone,
        message: 'Zone deleted successfully',
    });
});

/**
 * POST /api/zones/:zoneId/restore
 * Restore a soft-deleted zone.
 */
export const restoreZone = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    
    const zone = await Zone.findOneAndUpdate(
        { zoneId },
        { isActive: true },
        { new: true }
    );
    
    if (!zone) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Zone not found',
        });
    }
    
    // Invalidate cache
    invalidateZonesCache();
    
    res.status(200).json({
        success: true,
        data: zone,
        message: 'Zone restored successfully',
    });
});

/**
 * GET /api/zones/transitions/recent
 * Get recent zone transitions across all sessions.
 */
export const getRecentTransitions = asyncHandler(async (req, res) => {
    const { limit } = req.query;
    
    // Dynamic import to avoid circular dependency
    const ZoneTransition = (await import('../models/ZoneTransition.js')).default;
    
    const transitions = await ZoneTransition.getRecentTransitions(
        parseInt(limit) || 100
    );
    
    res.status(200).json({
        success: true,
        data: transitions,
        message: `Found ${transitions.length} recent transitions`,
    });
});

/**
 * GET /api/zones/current
 * Get current zone for all active trucks.
 */
export const getCurrentTruckZones = asyncHandler(async (req, res) => {
    const { getAllTruckZones } = await import('../services/zoneDetection.js');
    
    // Fix #5: await the async function
    const truckZones = await getAllTruckZones();
    
    res.status(200).json({
        success: true,
        data: truckZones,
        message: 'Current truck zones retrieved',
    });
});

/**
 * DELETE /api/zones/transitions
 * Delete all zone transitions (permanent).
 */
export const deleteAllTransitions = asyncHandler(async (req, res) => {
    const ZoneTransition = (await import('../models/ZoneTransition.js')).default;
    
    const result = await ZoneTransition.deleteMany({});
    
    res.status(200).json({
        success: true,
        data: { deletedCount: result.deletedCount },
        message: `Permanently deleted ${result.deletedCount} zone transitions`,
    });
});
