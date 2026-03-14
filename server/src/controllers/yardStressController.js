import { asyncHandler } from '../middleware/errorHandler.js';
import { calculateYardStressIndex } from '../services/yardStressService.js';

export const getYardStress = asyncHandler(async (_req, res) => {
    const result = await calculateYardStressIndex();

    res.status(200).json({
        success: true,
        data: result,
        message: 'Yard stress index computed successfully',
    });
});
