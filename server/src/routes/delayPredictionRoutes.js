import { Router } from 'express';
import { getDelayPredictions } from '../controllers/delayPredictionController.js';

const router = Router();

router.get('/delay-predictions', getDelayPredictions);

export default router;
