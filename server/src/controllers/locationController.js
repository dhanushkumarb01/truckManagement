import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * In-memory storage for GPS location events.
 * In production, this would be persisted to a database.
 */
const gpsEventLogs = [];

let eventIdCounter = 1;

/**
 * Validates the location payload.
 * Returns an array of error messages (empty if valid).
 */
function validateLocationPayload(body) {
    const errors = [];

    if (!body.truckId || typeof body.truckId !== 'string') {
        errors.push('truckId is required and must be a string');
    }

    if (typeof body.latitude !== 'number' || isNaN(body.latitude)) {
        errors.push('latitude is required and must be a number');
    }

    if (typeof body.longitude !== 'number' || isNaN(body.longitude)) {
        errors.push('longitude is required and must be a number');
    }

    if (typeof body.accuracy !== 'number' || isNaN(body.accuracy)) {
        errors.push('accuracy is required and must be a number');
    }

    if (!body.timestamp || typeof body.timestamp !== 'string') {
        errors.push('timestamp is required and must be a string');
    } else {
        // Validate ISO 8601 format
        const date = new Date(body.timestamp);
        if (isNaN(date.getTime())) {
            errors.push('timestamp must be a valid ISO 8601 date string');
        }
    }

    return errors;
}

/**
 * POST /api/location
 * Receives GPS location data from Android app.
 */
export const receiveLocation = asyncHandler(async (req, res) => {
    const { truckId, latitude, longitude, accuracy, timestamp } = req.body;

    // Validate payload
    const validationErrors = validateLocationPayload(req.body);
    if (validationErrors.length > 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: validationErrors.join('; '),
        });
    }

    // Create GPS event log entry
    const gpsEvent = {
        id: eventIdCounter++,
        truckId,
        latitude,
        longitude,
        accuracy,
        timestamp,
        eventType: 'GPS_UPDATE',
    };

    // Store in memory
    gpsEventLogs.push(gpsEvent);

    // Console logging as requested
    console.log(`GPS update received from ${truckId} at ${latitude}, ${longitude}`);

    res.status(201).json({
        success: true,
        data: gpsEvent,
        message: 'Location received successfully',
    });
});

/**
 * GET /api/events
 * Returns all GPS event logs, sorted by latest first.
 */
export const getGpsEvents = asyncHandler(async (req, res) => {
    // Sort by timestamp descending (latest first)
    const sortedEvents = [...gpsEventLogs].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    res.json({
        success: true,
        data: sortedEvents,
        message: `${sortedEvents.length} GPS event(s) found`,
    });
});

/**
 * Export for testing or external access if needed.
 */
export { gpsEventLogs };
