import { asyncHandler } from '../middleware/errorHandler.js';
import { getOperationalDelayPredictions } from '../services/delayPredictionService.js';

export const getDelayPredictions = asyncHandler(async (_req, res) => {
    const predictions = await getOperationalDelayPredictions();

    res.status(200).json({
        success: true,
        predictions,
        message: 'Delay predictions generated',
    });
});
