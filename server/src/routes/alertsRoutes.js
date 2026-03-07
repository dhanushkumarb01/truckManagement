/**
 * Alerts Routes
 * Dashboard and management for proximity and anomaly alerts.
 * 
 * GET /api/alerts/dashboard - Combined dashboard view
 * GET /api/alerts/proximity - List proximity alerts
 * GET /api/alerts/proximity/stats - Proximity statistics
 * POST /api/alerts/proximity/:id/acknowledge - Acknowledge alert
 * GET /api/alerts/anomalies - List anomaly alerts
 * GET /api/alerts/anomalies/stats - Anomaly statistics
 * POST /api/alerts/anomalies/:id/acknowledge - Acknowledge alert
 * POST /api/alerts/acknowledge-batch - Batch acknowledge
 */

import { Router } from 'express';
import {
    getDashboardAlerts,
    getProximityAlerts,
    getProximityStats,
    acknowledgeProximityAlert,
    getAnomalyAlerts,
    getAnomalyStats,
    acknowledgeAnomalyAlert,
    acknowledgeBatch,
    deleteProximityAlerts,
    deleteAnomalyAlerts,
    deleteAllAlerts,
} from '../controllers/alertsController.js';

const router = Router();

// Dashboard
router.get('/dashboard', getDashboardAlerts);

// Proximity
router.get('/proximity', getProximityAlerts);
router.get('/proximity/stats', getProximityStats);
router.post('/proximity/:id/acknowledge', acknowledgeProximityAlert);

// Anomalies
router.get('/anomalies', getAnomalyAlerts);
router.get('/anomalies/stats', getAnomalyStats);
router.post('/anomalies/:id/acknowledge', acknowledgeAnomalyAlert);

// Batch
router.post('/acknowledge-batch', acknowledgeBatch);

// Delete
router.delete('/proximity', deleteProximityAlerts);
router.delete('/anomalies', deleteAnomalyAlerts);
router.delete('/all', deleteAllAlerts);

export default router;
