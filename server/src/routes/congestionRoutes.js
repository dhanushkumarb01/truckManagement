import { Router } from 'express';
import { getCongestionZones } from '../controllers/congestionController.js';

const router = Router();

router.get('/congestion', getCongestionZones);

export default router;
