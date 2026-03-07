/**
 * RFID Routes
 * Endpoints for RFID/FastTag gate scanning workflow.
 * 
 * Base path: /api/rfid
 * 
 * Production usage:
 * - Real RFID systems can POST to /api/rfid/scan directly
 * - Same endpoint works for both demo simulation and production webhooks
 */

import { Router } from 'express';
import { scanRfid, getSessionStatus, consumeQr } from '../controllers/rfidController.js';

const router = Router();

/**
 * POST /api/rfid/scan
 * Process RFID/FastTag scan at gate.
 * 
 * Body: { fastTagId, vehicleRegistration, yardId? }
 * Returns: { sessionId, truckId, qrImage }
 */
router.post('/scan', scanRfid);

/**
 * GET /api/rfid/status/:sessionId
 * Check session status after QR generation.
 */
router.get('/status/:sessionId', getSessionStatus);

/**
 * POST /api/qr/consume
 * Mark QR as consumed when driver scans it.
 * 
 * Body: { sessionId, truckId? }
 * Returns: { sessionId, truckId, driverLinked }
 */
router.post('/qr/consume', consumeQr);

export default router;
