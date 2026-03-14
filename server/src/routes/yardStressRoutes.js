import { Router } from 'express';
import { getYardStress } from '../controllers/yardStressController.js';

const router = Router();

router.get('/stress', getYardStress);

export default router;
