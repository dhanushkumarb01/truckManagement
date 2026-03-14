import { asyncHandler } from '../middleware/errorHandler.js';
import { detectCongestionZones } from '../services/congestionService.js';

export const getCongestionZones = asyncHandler(async (_req, res) => {
    try {
        const zones = await detectCongestionZones();

        res.status(200).json({
            success: true,
            zones,
            message: 'Congestion zones retrieved',
        });
    } catch (error) {
        console.error('Congestion detection failed:', error.message);
        res.status(200).json({
            success: false,
            zones: [],
            message: 'Congestion data unavailable',
        });
    }
});
