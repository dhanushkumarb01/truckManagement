import { Router } from 'express';
import { getEvents } from '../controllers/eventController.js';
import { getGpsEvents } from '../controllers/locationController.js';

const router = Router();

/**
 * GET /api/events
 * Returns all GPS event logs, sorted by latest first.
 */
router.get('/', getGpsEvents);

/**
 * GET /api/events/:truckId
 * Returns all events for a specific truck.
 */
router.get('/:truckId', getEvents);

export default router;
