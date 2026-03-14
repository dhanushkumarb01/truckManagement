import { asyncHandler } from '../middleware/errorHandler.js';
import { analyseDriverBehaviour } from '../services/driverBehaviourService.js';

export const getDriverBehaviour = asyncHandler(async (_req, res) => {
    const drivers = await analyseDriverBehaviour();

    res.status(200).json({
        success: true,
        drivers,
        message: 'Driver behaviour analysis complete',
    });
});
