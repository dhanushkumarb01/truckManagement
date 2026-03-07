/**
 * RFID Controller
 * Handles simulated RFID/FastTag scans at yard gates.
 * 
 * Flow:
 * 1. Gate operator scans RFID/FastTag
 * 2. Backend creates YardSession
 * 3. Backend generates QR code for driver
 * 4. Driver scans QR to activate GPS tracking
 * 
 * This controller is production-ready for real RFID webhook integration.
 */

import { asyncHandler } from '../middleware/errorHandler.js';
import TruckSession from '../models/TruckSession.js';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/rfid/scan
 * Process RFID/FastTag scan and generate session QR code.
 * 
 * Input:
 * - fastTagId: FastTag identifier (e.g., "FT12345")
 * - vehicleRegistration: Vehicle plate number (e.g., "TS09AB1234")
 * - yardId: Yard identifier (default: "YARD-01")
 * 
 * Output:
 * - sessionId: Created session ID
 * - truckId: Derived truck identifier
 * - qrImage: Base64 encoded QR code image
 */
export const scanRfid = asyncHandler(async (req, res) => {
    const { fastTagId, vehicleRegistration, yardId = 'YARD-01' } = req.body;

    // Validate required fields
    if (!fastTagId || typeof fastTagId !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'fastTagId is required',
        });
    }

    if (!vehicleRegistration || typeof vehicleRegistration !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'vehicleRegistration is required',
        });
    }

    // Derive truckId from vehicle registration (normalize)
    const truckId = vehicleRegistration.trim().toUpperCase().replace(/\s+/g, '');

    // Check for existing active session for this truck
    const existingSession = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });

    // If active session exists, mark it as EXITED
    if (existingSession) {
        existingSession.state = 'EXITED';
        await existingSession.save();
        console.log(`⚠️ Closed existing session for ${truckId}`);
    }

    // Create new session
    const sessionId = uuidv4();
    const session = await TruckSession.create({
        truckId,
        state: 'ENTRY',
        // Store RFID/FastTag metadata
        fastTagId: fastTagId.trim(),
        vehicleRegistration: vehicleRegistration.trim().toUpperCase(),
        yardId,
        entryTimestamp: new Date(),
        startedBy: 'RFID',
    });

    console.log(`✅ RFID scan: Created session for ${truckId} (FastTag: ${fastTagId})`);

    // Generate QR payload with session binding info
    const qrPayload = JSON.stringify({
        sessionId: session._id.toString(),
        truckId,
        yardId,
        fastTagId,
        qrExpiresAt: session.qrExpiresAt?.toISOString(),
        timestamp: Date.now(),
    });

    // Generate QR code as base64 PNG
    let qrImage;
    try {
        qrImage = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });
    } catch (qrError) {
        console.error('QR generation failed:', qrError);
        return res.status(500).json({
            success: false,
            data: null,
            message: 'Failed to generate QR code',
        });
    }

    res.status(201).json({
        success: true,
        data: {
            sessionId: session._id.toString(),
            truckId,
            vehicleRegistration,
            yardId,
            fastTagId,
            qrImage,
            qrCreatedAt: session.qrCreatedAt,
            qrExpiresAt: session.qrExpiresAt,
            status: 'AWAITING_DRIVER_SCAN',
        },
        message: 'RFID scan successful. QR code generated for driver.',
    });
});

/**
 * GET /api/rfid/status/:sessionId
 * Check session status after QR generation.
 * Includes QR expiration validation.
 */
export const getSessionStatus = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'sessionId is required',
        });
    }

    const session = await TruckSession.findById(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Session not found',
        });
    }

    // Check QR expiration
    const isQrExpired = session.isQrExpired();

    res.status(200).json({
        success: true,
        data: {
            sessionId: session._id.toString(),
            truckId: session.truckId,
            state: session.state,
            isActive: session.state !== 'EXITED',
            qrCreatedAt: session.qrCreatedAt,
            qrExpiresAt: session.qrExpiresAt,
            isQrExpired,
            createdAt: session.createdAt,
        },
        message: isQrExpired ? 'QR code has expired' : 'Session status retrieved',
    });
});

/**
 * POST /api/qr/consume
 * Mark QR as consumed when driver scans it.
 * Sets driverLinked = true and validates session binding.
 * 
 * Input:
 * - sessionId: The session ID from QR code
 * - truckId: The truck ID from QR code (for validation)
 * 
 * Output:
 * - Session object with driverLinked = true
 */
export const consumeQr = asyncHandler(async (req, res) => {
    const { sessionId, truckId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'sessionId is required',
        });
    }

    const session = await TruckSession.findById(sessionId);

    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Session not found',
        });
    }

    // Validate truckId matches (security check)
    if (truckId && session.truckId !== truckId) {
        return res.status(403).json({
            success: false,
            data: null,
            message: 'Session ID does not match truck ID',
        });
    }

    // Check if QR has expired
    if (session.isQrExpired && session.isQrExpired()) {
        return res.status(410).json({
            success: false,
            data: null,
            message: 'QR code has expired. Please request a new scan.',
        });
    }

    // Check if session is still active
    if (session.state === 'EXITED') {
        return res.status(409).json({
            success: false,
            data: null,
            message: 'Session has already ended',
        });
    }

    // Mark driver as linked
    session.driverLinked = true;
    session.driverLinkedAt = new Date();
    await session.save();

    console.log(`📱 QR consumed: Driver linked for ${session.truckId}`);

    res.status(200).json({
        success: true,
        data: {
            sessionId: session._id.toString(),
            truckId: session.truckId,
            state: session.state,
            driverLinked: session.driverLinked,
            driverLinkedAt: session.driverLinkedAt,
        },
        message: 'QR code consumed. GPS tracking enabled.',
    });
});
