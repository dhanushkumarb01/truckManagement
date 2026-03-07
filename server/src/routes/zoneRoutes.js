/**
 * Zone Routes
 * CRUD operations for zone management + transitions.
 * 
 * POST /api/zones - Create zone
 * GET /api/zones - List all zones
 * GET /api/zones/current - Get current zone for all trucks
 * GET /api/zones/transitions/recent - Get recent transitions
 * GET /api/zones/:zoneId - Get zone details
 * PUT /api/zones/:zoneId - Update zone
 * DELETE /api/zones/:zoneId - Soft delete zone
 * POST /api/zones/:zoneId/restore - Restore deleted zone
 */

import { Router } from 'express';
import {
    createZone,
    getZones,
    getZone,
    updateZone,
    deleteZone,
    restoreZone,
    getRecentTransitions,
    getCurrentTruckZones,
    deleteAllTransitions,
} from '../controllers/zoneController.js';

const router = Router();

// Zone CRUD
router.post('/', createZone);
router.get('/', getZones);
router.get('/current', getCurrentTruckZones);
router.get('/transitions/recent', getRecentTransitions);
router.delete('/transitions', deleteAllTransitions);
router.get('/:zoneId', getZone);
router.put('/:zoneId', updateZone);
router.delete('/:zoneId', deleteZone);
router.post('/:zoneId/restore', restoreZone);

export default router;
