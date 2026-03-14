import { Router } from 'express';
import { getDriverBehaviour } from '../controllers/driverBehaviourController.js';

const router = Router();

router.get('/driver-behaviour', getDriverBehaviour);

export default router;
