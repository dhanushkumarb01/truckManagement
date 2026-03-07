import express from 'express';
import YardConfig from '../models/YardConfig.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/yard-config
 * Get yard configuration (returns active config for DEFAULT_YARD)
 */
router.get('/', asyncHandler(async (req, res) => {
    const config = await YardConfig.getConfig('DEFAULT_YARD');
    res.json({
        success: true,
        data: config,
        message: 'Yard configuration retrieved',
    });
}));

/**
 * PUT /api/yard-config
 * Update yard configuration including polygon boundary
 * Body: {
 *   boundaryType: 'polygon' | 'circle',
 *   boundaryPolygon: [{ lat, lng }, ...],  // for polygon type
 *   centerLat, centerLng, maxDistanceKm,   // for circle type
 *   ...other config fields
 * }
 */
router.put('/', asyncHandler(async (req, res) => {
    const {
        boundaryType,
        boundaryPolygon,
        centerLat,
        centerLng,
        maxDistanceKm,
        maxSpeedKmh,
        truckProximityAlertM,
        eventThrottleWindowSec,
        oscillationWindowSec,
        oscillationThreshold,
    } = req.body;

    // Validate polygon if provided
    if (boundaryType === 'polygon') {
        if (!Array.isArray(boundaryPolygon) || boundaryPolygon.length < 3) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Polygon boundary must have at least 3 points',
            });
        }
        
        // Validate each point
        for (let i = 0; i < boundaryPolygon.length; i++) {
            const point = boundaryPolygon[i];
            if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: `Invalid coordinates at point ${i}`,
                });
            }
            if (point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
                return res.status(400).json({
                    success: false,
                    data: null,
                    message: `Coordinates out of range at point ${i}`,
                });
            }
        }
    }

    // Build update object
    const updateData = {};
    if (boundaryType) updateData.boundaryType = boundaryType;
    if (boundaryPolygon) updateData.boundaryPolygon = boundaryPolygon;
    if (centerLat != null) updateData.centerLat = centerLat;
    if (centerLng != null) updateData.centerLng = centerLng;
    if (maxDistanceKm != null) updateData.maxDistanceKm = maxDistanceKm;
    if (maxSpeedKmh != null) updateData.maxSpeedKmh = maxSpeedKmh;
    if (truckProximityAlertM != null) updateData.truckProximityAlertM = truckProximityAlertM;
    if (eventThrottleWindowSec != null) updateData.eventThrottleWindowSec = eventThrottleWindowSec;
    if (oscillationWindowSec != null) updateData.oscillationWindowSec = oscillationWindowSec;
    if (oscillationThreshold != null) updateData.oscillationThreshold = oscillationThreshold;

    // Upsert config (create if doesn't exist)
    const config = await YardConfig.findOneAndUpdate(
        { yardId: 'DEFAULT_YARD' },
        {
            $set: updateData,
            $setOnInsert: { yardId: 'DEFAULT_YARD', yardName: 'Default Yard' },
        },
        { upsert: true, new: true, runValidators: true }
    );

    // Clear cache in locationController (broadcast event or use pub/sub in production)
    // For now, the cache has 5-min TTL so it will auto-refresh

    res.json({
        success: true,
        data: config,
        message: 'Yard configuration updated',
    });
}));

export default router;
