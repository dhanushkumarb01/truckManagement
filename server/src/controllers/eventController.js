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

/**
 * DELETE /api/events
 * Delete all event logs (permanent).
 */
export const deleteAllEvents = asyncHandler(async (req, res) => {
    const result = await EventLog.deleteMany({});
    
    res.status(200).json({
        success: true,
        data: { deletedCount: result.deletedCount },
        message: `Permanently deleted ${result.deletedCount} events`,
    });
});
