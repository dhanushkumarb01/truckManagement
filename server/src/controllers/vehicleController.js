/**
 * Vehicle Controller
 * Manages Vehicle Master collection - CRUD operations for registered vehicles.
 */

import { asyncHandler } from '../middleware/errorHandler.js';
import Vehicle from '../models/Vehicle.js';

/**
 * POST /api/vehicles
 * Register a new vehicle with FastTag.
 */
export const createVehicle = asyncHandler(async (req, res) => {
    const {
        vehicleNumber,
        fastTagId,
        vehicleType,
        ownerName,
        transporterCode,
    } = req.body;
    
    // Validate required fields
    if (!vehicleNumber || typeof vehicleNumber !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'vehicleNumber is required',
        });
    }
    
    if (!fastTagId || typeof fastTagId !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'fastTagId is required',
        });
    }
    
    // Check for duplicates
    const existingByNumber = await Vehicle.findOne({ 
        vehicleNumber: vehicleNumber.toUpperCase().trim() 
    });
    
    if (existingByNumber) {
        return res.status(409).json({
            success: false,
            data: null,
            message: `Vehicle ${vehicleNumber.toUpperCase()} is already registered`,
        });
    }
    
    const existingByFastTag = await Vehicle.findOne({ 
        fastTagId: fastTagId.trim() 
    });
    
    if (existingByFastTag) {
        return res.status(409).json({
            success: false,
            data: null,
            message: `FastTag ${fastTagId} is already registered to ${existingByFastTag.vehicleNumber}`,
        });
    }
    
    // Create vehicle
    const vehicle = await Vehicle.create({
        vehicleNumber: vehicleNumber.toUpperCase().trim(),
        fastTagId: fastTagId.trim(),
        vehicleType: vehicleType || 'TRUCK',
        status: 'ACTIVE',
        ownerName: ownerName?.trim(),
        transporterCode: transporterCode?.trim(),
    });
    
    console.log(`✅ Registered vehicle: ${vehicle.vehicleNumber}`);
    
    res.status(201).json({
        success: true,
        data: vehicle,
        message: 'Vehicle registered successfully',
    });
});

/**
 * GET /api/vehicles
 * List all registered vehicles.
 */
export const getAllVehicles = asyncHandler(async (req, res) => {
    const { status, vehicleType, search } = req.query;
    
    const query = {};
    
    if (status) {
        query.status = status.toUpperCase();
    }
    
    if (vehicleType) {
        query.vehicleType = vehicleType.toUpperCase();
    }
    
    if (search) {
        query.$or = [
            { vehicleNumber: { $regex: search, $options: 'i' } },
            { fastTagId: { $regex: search, $options: 'i' } },
            { ownerName: { $regex: search, $options: 'i' } },
        ];
    }
    
    const vehicles = await Vehicle.find(query)
        .sort({ createdAt: -1 })
        .lean();
    
    res.status(200).json({
        success: true,
        data: vehicles,
        message: `Found ${vehicles.length} vehicles`,
    });
});

/**
 * GET /api/vehicles/:identifier
 * Get vehicle by vehicleNumber or fastTagId.
 */
export const getVehicle = asyncHandler(async (req, res) => {
    const { identifier } = req.params;
    
    const vehicle = await Vehicle.findOne({
        $or: [
            { vehicleNumber: identifier.toUpperCase() },
            { fastTagId: identifier },
        ]
    });
    
    if (!vehicle) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Vehicle not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: vehicle,
        message: 'Vehicle found',
    });
});

/**
 * PUT /api/vehicles/:vehicleNumber
 * Update vehicle details.
 */
export const updateVehicle = asyncHandler(async (req, res) => {
    const { vehicleNumber } = req.params;
    const updates = req.body;
    
    // Prevent changing vehicleNumber
    delete updates.vehicleNumber;
    
    // Check fastTagId uniqueness if being updated
    if (updates.fastTagId) {
        const existing = await Vehicle.findOne({
            fastTagId: updates.fastTagId.trim(),
            vehicleNumber: { $ne: vehicleNumber.toUpperCase() },
        });
        
        if (existing) {
            return res.status(409).json({
                success: false,
                data: null,
                message: `FastTag ${updates.fastTagId} is already registered to ${existing.vehicleNumber}`,
            });
        }
    }
    
    const vehicle = await Vehicle.findOneAndUpdate(
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { $set: updates },
        { new: true }
    );
    
    if (!vehicle) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Vehicle not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: vehicle,
        message: 'Vehicle updated',
    });
});

/**
 * PATCH /api/vehicles/:vehicleNumber/status
 * Update vehicle status (ACTIVE/INACTIVE/BLOCKED).
 */
export const updateVehicleStatus = asyncHandler(async (req, res) => {
    const { vehicleNumber } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
    if (!status || !validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
            success: false,
            data: null,
            message: `Status must be one of: ${validStatuses.join(', ')}`,
        });
    }
    
    const vehicle = await Vehicle.findOneAndUpdate(
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { status: status.toUpperCase() },
        { new: true }
    );
    
    if (!vehicle) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Vehicle not found',
        });
    }
    
    console.log(`🚛 Vehicle ${vehicleNumber} status → ${status.toUpperCase()}`);
    
    res.status(200).json({
        success: true,
        data: vehicle,
        message: `Vehicle status updated to ${status.toUpperCase()}`,
    });
});

/**
 * DELETE /api/vehicles/:vehicleNumber
 * Remove a vehicle (soft delete by setting status to INACTIVE).
 */
export const deleteVehicle = asyncHandler(async (req, res) => {
    const { vehicleNumber } = req.params;
    
    const vehicle = await Vehicle.findOneAndUpdate(
        { vehicleNumber: vehicleNumber.toUpperCase() },
        { status: 'INACTIVE' },
        { new: true }
    );
    
    if (!vehicle) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Vehicle not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: vehicle,
        message: 'Vehicle deactivated',
    });
});
