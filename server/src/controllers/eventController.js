import EventLog from '../models/EventLog.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * GET /api/events/:truckId
 * Returns all events for a truck, newest first.
 */
export const getEvents = asyncHandler(async (req, res) => {
    const { truckId } = req.params;

    const events = await EventLog.find({ truckId })
        .sort({ timestamp: -1 })
        .lean();

    res.json({
        success: true,
        data: events,
        message: `${events.length} event(s) found`,
    });
});
