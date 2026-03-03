/**
 * Vehicle Routes
 * CRUD operations for Vehicle Master collection.
 * 
 * POST /api/vehicles - Register new vehicle
 * GET /api/vehicles - List all vehicles
 * GET /api/vehicles/:identifier - Get by vehicleNumber or fastTagId
 * PUT /api/vehicles/:vehicleNumber - Update vehicle
 * PATCH /api/vehicles/:vehicleNumber/status - Update status
 * DELETE /api/vehicles/:vehicleNumber - Soft delete (deactivate)
 */

import { Router } from 'express';
import {
    createVehicle,
    getAllVehicles,
    getVehicle,
    updateVehicle,
    updateVehicleStatus,
    deleteVehicle,
} from '../controllers/vehicleController.js';

const router = Router();

router.post('/', createVehicle);
router.get('/', getAllVehicles);
router.get('/:identifier', getVehicle);
router.put('/:vehicleNumber', updateVehicle);
router.patch('/:vehicleNumber/status', updateVehicleStatus);
router.delete('/:vehicleNumber', deleteVehicle);

export default router;
