import { Router } from 'express';
import { receiveLocation } from '../controllers/locationController.js';

const router = Router();

/**
 * POST /api/location
 * Receives GPS location data from Android app.
 */
router.post('/', receiveLocation);

export default router;
