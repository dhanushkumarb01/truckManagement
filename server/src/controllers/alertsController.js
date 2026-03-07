/**
 * Alerts Controller
 * Handles proximity violations and anomaly alerts.
 * Provides dashboard data for real-time monitoring.
 */

import { asyncHandler } from '../middleware/errorHandler.js';
import ProximityEvent from '../models/ProximityEvent.js';
import AnomalyEvent from '../models/AnomalyEvent.js';
import EventLog from '../models/EventLog.js';

// ============ PROXIMITY ALERTS ============

/**
 * GET /api/alerts/proximity
 * Get recent proximity violations.
 */
export const getProximityAlerts = asyncHandler(async (req, res) => {
    const { limit, unacknowledged, severity, sessionId } = req.query;
    
    const query = {};
    
    if (unacknowledged === 'true') {
        query.acknowledged = false;
    }
    
    if (severity) {
        query.severity = severity.toUpperCase();
    }
    
    if (sessionId) {
        query.sessionId = sessionId;
    }
    
    const alerts = await ProximityEvent.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit) || 50)
        .lean();
    
    res.status(200).json({
        success: true,
        data: alerts,
        message: `Found ${alerts.length} proximity alerts`,
    });
});

/**
 * GET /api/alerts/proximity/stats
 * Get proximity alert statistics.
 */
export const getProximityStats = asyncHandler(async (req, res) => {
    const { hours } = req.query;
    const since = new Date(Date.now() - (parseInt(hours) || 24) * 60 * 60 * 1000);
    
    const stats = await ProximityEvent.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
            $group: {
                _id: '$violationType',
                count: { $sum: 1 },
                avgRssi: { $avg: '$bleSignalStrength' },
            }
        },
        { $sort: { count: -1 } }
    ]);
    
    const totalUnacknowledged = await ProximityEvent.countDocuments({
        acknowledged: false,
        timestamp: { $gte: since },
    });
    
    res.status(200).json({
        success: true,
        data: {
            byType: stats,
            totalUnacknowledged,
            period: `${hours || 24} hours`,
        },
        message: 'Proximity statistics retrieved',
    });
});

/**
 * POST /api/alerts/proximity/:id/acknowledge
 * Acknowledge a proximity alert.
 */
export const acknowledgeProximityAlert = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { acknowledgedBy, notes } = req.body;
    
    const alert = await ProximityEvent.findByIdAndUpdate(
        id,
        {
            acknowledged: true,
            acknowledgedBy: acknowledgedBy || 'operator',
            acknowledgedAt: new Date(),
            notes: notes || null,
        },
        { new: true }
    );
    
    if (!alert) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Alert not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: alert,
        message: 'Alert acknowledged',
    });
});

// ============ ANOMALY ALERTS ============

/**
 * GET /api/alerts/anomalies
 * Get recent anomaly events.
 */
export const getAnomalyAlerts = asyncHandler(async (req, res) => {
    const { limit, unresolved, anomalyType, severity, sessionId } = req.query;
    
    const query = {};
    
    if (unresolved === 'true') {
        query.acknowledged = false;
        query.autoResolved = false;
    }
    
    if (anomalyType) {
        query.anomalyType = anomalyType.toUpperCase();
    }
    
    if (severity) {
        query.severity = severity.toUpperCase();
    }
    
    if (sessionId) {
        query.sessionId = sessionId;
    }
    
    const alerts = await AnomalyEvent.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit) || 50)
        .lean();
    
    res.status(200).json({
        success: true,
        data: alerts,
        message: `Found ${alerts.length} anomaly alerts`,
    });
});

/**
 * GET /api/alerts/anomalies/stats
 * Get anomaly statistics.
 */
export const getAnomalyStats = asyncHandler(async (req, res) => {
    const { hours } = req.query;
    
    const stats = await AnomalyEvent.getAnomalyStats(parseInt(hours) || 24);
    
    const totalUnresolved = await AnomalyEvent.countDocuments({
        acknowledged: false,
        autoResolved: false,
    });
    
    res.status(200).json({
        success: true,
        data: {
            byType: stats,
            totalUnresolved,
            period: `${hours || 24} hours`,
        },
        message: 'Anomaly statistics retrieved',
    });
});

/**
 * POST /api/alerts/anomalies/:id/acknowledge
 * Acknowledge an anomaly alert.
 */
export const acknowledgeAnomalyAlert = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { acknowledgedBy, notes } = req.body;
    
    const alert = await AnomalyEvent.findByIdAndUpdate(
        id,
        {
            acknowledged: true,
            acknowledgedBy: acknowledgedBy || 'operator',
            acknowledgedAt: new Date(),
            notes: notes || null,
        },
        { new: true }
    );
    
    if (!alert) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Alert not found',
        });
    }
    
    res.status(200).json({
        success: true,
        data: alert,
        message: 'Alert acknowledged',
    });
});

// ============ COMBINED DASHBOARD ============

/**
 * GET /api/alerts/dashboard
 * Get combined alert summary for dashboard.
 */
export const getDashboardAlerts = asyncHandler(async (req, res) => {
    const { limit } = req.query;
    const alertLimit = parseInt(limit) || 20;
    
    // Alert event types from EventLog
    const alertEventTypes = ['OUT_OF_YARD', 'ZONE_ANOMALY', 'SPEED_VIOLATION', 'GEOFENCE_VIOLATION'];
    
    // Get recent unacknowledged alerts of each type
    const [proximityAlerts, anomalyAlerts, eventLogAlerts] = await Promise.all([
        ProximityEvent.find({ acknowledged: false })
            .sort({ timestamp: -1 })
            .limit(alertLimit)
            .lean(),
        AnomalyEvent.find({ acknowledged: false, autoResolved: false })
            .sort({ timestamp: -1 })
            .limit(alertLimit)
            .lean(),
        EventLog.find({ 
            acknowledged: false,
            eventType: { $in: alertEventTypes },
        })
            .sort({ timestamp: -1 })
            .limit(alertLimit)
            .lean(),
    ]);
    
    // Get counts
    const [proximityCount, anomalyCount, eventLogCount] = await Promise.all([
        ProximityEvent.countDocuments({ acknowledged: false }),
        AnomalyEvent.countDocuments({ acknowledged: false, autoResolved: false }),
        EventLog.countDocuments({ 
            acknowledged: false,
            eventType: { $in: alertEventTypes },
        }),
    ]);
    
    // Merge and sort by timestamp
    // Normalize EventLog alerts to have consistent fields
    const normalizedEventLogAlerts = eventLogAlerts.map(a => ({
        ...a,
        alertCategory: 'SYSTEM',
        // Map eventType to alertType for consistent frontend rendering
        alertType: a.eventType,
        violationType: a.eventType,
        anomalyType: a.eventType,
        // Ensure severity is uppercase
        severity: (a.severity || 'medium').toUpperCase(),
    }));
    
    const allAlerts = [
        ...proximityAlerts.map(a => ({ ...a, alertCategory: 'PROXIMITY' })),
        ...anomalyAlerts.map(a => ({ ...a, alertCategory: 'ANOMALY' })),
        ...normalizedEventLogAlerts,
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, alertLimit);
    
    res.status(200).json({
        success: true,
        data: {
            alerts: allAlerts,
            counts: {
                proximity: proximityCount,
                anomaly: anomalyCount,
                system: eventLogCount,
                total: proximityCount + anomalyCount + eventLogCount,
            },
        },
        message: 'Dashboard alerts retrieved',
    });
});

/**
 * POST /api/alerts/acknowledge-batch
 * Acknowledge multiple alerts at once.
 */
export const acknowledgeBatch = asyncHandler(async (req, res) => {
    const { alertIds, category, acknowledgedBy } = req.body;
    
    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'alertIds array is required',
        });
    }
    
    let Model;
    if (category === 'PROXIMITY') {
        Model = ProximityEvent;
    } else if (category === 'SYSTEM') {
        Model = EventLog;
    } else {
        Model = AnomalyEvent;
    }
    
    const result = await Model.updateMany(
        { _id: { $in: alertIds } },
        {
            acknowledged: true,
            acknowledgedBy: acknowledgedBy || 'operator',
            acknowledgedAt: new Date(),
        }
    );
    
    res.status(200).json({
        success: true,
        data: {
            modifiedCount: result.modifiedCount,
        },
        message: `Acknowledged ${result.modifiedCount} alerts`,
    });
});

// ============ DELETE ALERTS ============

/**
 * DELETE /api/alerts/proximity
 * Delete all proximity alerts.
 */
export const deleteProximityAlerts = asyncHandler(async (req, res) => {
    const result = await ProximityEvent.deleteMany({});
    
    res.status(200).json({
        success: true,
        data: { deletedCount: result.deletedCount },
        message: `Permanently deleted ${result.deletedCount} proximity alerts`,
    });
});

/**
 * DELETE /api/alerts/anomalies
 * Delete all anomaly alerts.
 */
export const deleteAnomalyAlerts = asyncHandler(async (req, res) => {
    const result = await AnomalyEvent.deleteMany({});
    
    res.status(200).json({
        success: true,
        data: { deletedCount: result.deletedCount },
        message: `Permanently deleted ${result.deletedCount} anomaly alerts`,
    });
});

/**
 * DELETE /api/alerts/all
 * Delete all alerts (proximity + anomaly).
 */
export const deleteAllAlerts = asyncHandler(async (req, res) => {
    const [proximityResult, anomalyResult] = await Promise.all([
        ProximityEvent.deleteMany({}),
        AnomalyEvent.deleteMany({}),
    ]);
    
    const totalDeleted = proximityResult.deletedCount + anomalyResult.deletedCount;
    
    res.status(200).json({
        success: true,
        data: {
            proximity: proximityResult.deletedCount,
            anomaly: anomalyResult.deletedCount,
            total: totalDeleted,
        },
        message: `Permanently deleted ${totalDeleted} alerts`,
    });
});
