/**
 * FastTag Controller
 * Handles FastTag-based entry and session binding.
 * 
 * INTEGRATION FLOW:
 * 1. Vehicle approaches gate → FastTag reader reads tag
 * 2. External system calls POST /api/fastag/entry with fastTagId
 * 3. This creates YardSession with unique sessionId
 * 4. QR code is generated containing sessionId
 * 5. Driver scans QR → Mobile app uses sessionId for GPS tracking
 * 
 * BACKWARD COMPATIBILITY:
 * - Existing TruckSession workflow remains unchanged
 * - YardSession is an additional layer for identity binding
 * - Mobile app can still use UUID-based flow if FastTag not available
 */

import { asyncHandler } from '../middleware/errorHandler.js';
import Vehicle from '../models/Vehicle.js';
import YardSession from '../models/YardSession.js';
import TruckSession from '../models/TruckSession.js';
import EventLog from '../models/EventLog.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/fastag/entry
 * Creates a new yard session from FastTag entry.
 * 
 * Input:
 * - fastTagId: FastTag identifier from RFID reader
 * - vehicleNumber: Vehicle registration number
 * - entryTimestamp: When vehicle crossed the gate
 * - entryGate: (optional) Which gate was used
 * 
 * Output:
 * - sessionId: Unique session identifier
 * - qrPayload: Data to encode in QR code
 * - vehicleInfo: Registered vehicle details
 */
export const fastagEntry = asyncHandler(async (req, res) => {
    const { fastTagId, vehicleNumber, entryTimestamp, entryGate } = req.body;

    // Validate required fields
    if (!fastTagId || typeof fastTagId !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'fastTagId is required and must be a string',
        });
    }

    // Check if vehicle exists in master registry
    let vehicle = await Vehicle.findOne({
        fastTagId: fastTagId.trim(),
    });

    // AUTO-REGISTRATION: If vehicle not found, register it automatically
    if (!vehicle) {
        // Generate vehicle number if not provided
        const registrationNumber = vehicleNumber
            ? vehicleNumber.trim().toUpperCase()
            : `AUTO-${fastTagId.trim().slice(-8).toUpperCase()}`;

        // Check if vehicleNumber already exists (edge case)
        const existingByNumber = await Vehicle.findOne({ vehicleNumber: registrationNumber });
        if (existingByNumber) {
            return res.status(409).json({
                success: false,
                data: null,
                message: `Vehicle ${registrationNumber} already registered with different FastTag.`,
            });
        }

        // Auto-register the vehicle
        vehicle = await Vehicle.create({
            fastTagId: fastTagId.trim(),
            vehicleNumber: registrationNumber,
            vehicleType: 'TRUCK',
            status: 'ACTIVE',
        });

        // Log auto-registration
        console.log(`[INFO] Vehicle auto-registered from FastTag scan: ${registrationNumber} (FastTag: ${fastTagId})`);

        await EventLog.create({
            truckId: registrationNumber,
            eventType: 'VEHICLE_AUTO_REGISTERED',
            message: `Vehicle ${registrationNumber} auto-registered from FastTag scan (${fastTagId})`,
        });
    }

    // Check vehicle status
    if (vehicle.status !== 'ACTIVE') {
        await EventLog.create({
            truckId: vehicle.vehicleNumber,
            eventType: 'FASTAG_BLOCKED',
            message: `FastTag ${fastTagId} is ${vehicle.status}`,
        });

        return res.status(403).json({
            success: false,
            data: null,
            message: `Vehicle ${vehicle.vehicleNumber} is ${vehicle.status}. Entry not allowed.`,
        });
    }

    // Check for existing active session
    const existingSession = await YardSession.findActiveByVehicle(vehicle.vehicleNumber);

    if (existingSession) {
        return res.status(409).json({
            success: false,
            data: {
                existingSessionId: existingSession.sessionId,
                startTime: existingSession.startTime,
            },
            message: `Vehicle ${vehicle.vehicleNumber} already has an active session since ${existingSession.startTime}`,
        });
    }

    // Create new yard session
    const sessionId = uuidv4();
    const effectiveEntryTime = entryTimestamp ? new Date(entryTimestamp) : new Date();

    // Generate unique 6-digit driver code (Change 1)
    let driverCode;
    let codeIsUnique = false;
    while (!codeIsUnique) {
        driverCode = Math.floor(100000 + Math.random() * 900000).toString();
        const existingCode = await YardSession.findByDriverCode(driverCode);
        if (!existingCode) codeIsUnique = true;
    }

    // Driver code expires in 20 minutes
    const driverCodeExpiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const yardSession = await YardSession.create({
        sessionId,
        truckId: vehicle.vehicleNumber, // Use vehicleNumber for proper tracking
        vehicleNumber: vehicle.vehicleNumber,
        fastTagId: fastTagId.trim(),
        sessionStatus: 'ACTIVE',
        startTime: effectiveEntryTime,
        entryTimestamp: effectiveEntryTime,
        entryGate: entryGate || 'MAIN_GATE',
        driverCode, // Change 1: Store driver code
        driverCodeExpiresAt, // Driver code valid for 20 minutes
    });

    // Also create TruckSession for workflow compatibility
    // This ensures existing dashboard and workflow functions work
    let truckSession = await TruckSession.findOne({
        truckId: vehicle.vehicleNumber,
        state: { $ne: 'EXITED' },
    });

    if (!truckSession) {
        truckSession = await TruckSession.create({
            truckId: vehicle.vehicleNumber, // Use vehicleNumber for display
            state: 'ENTRY',
            fastTagId: fastTagId.trim(),
            vehicleRegistration: vehicle.vehicleNumber,
            yardId: 'DEFAULT_YARD',
            entryTimestamp: effectiveEntryTime,
            startedBy: 'FASTAG',
        });

        // Link TruckSession to YardSession
        yardSession.truckSessionId = truckSession._id;
        await yardSession.save();
    }

    // Log entry event
    await EventLog.create({
        truckId: vehicle.vehicleNumber,
        eventType: 'FASTAG_ENTRY',
        message: `Vehicle ${vehicle.vehicleNumber} entered via FastTag at ${entryGate || 'MAIN_GATE'}`,
    });

    // Generate QR payload
    const qrPayload = {
        sessionId,
        vehicleNumber: vehicle.vehicleNumber,
        timestamp: effectiveEntryTime.toISOString(),
        version: '2.0', // Indicates FastTag-enabled flow
    };

    console.log(`✅ FastTag entry: ${vehicle.vehicleNumber} → Session ${sessionId} → DriverCode ${driverCode}`);

    res.status(201).json({
        success: true,
        data: {
            sessionId,
            driverCode,
            qrPayload: JSON.stringify(qrPayload),
            qrPayloadObject: qrPayload,
            vehicleInfo: {
                vehicleNumber: vehicle.vehicleNumber,
                vehicleType: vehicle.vehicleType,
                ownerName: vehicle.ownerName,
                transporterCode: vehicle.transporterCode,
            },
            entryTimestamp: effectiveEntryTime,
            entryGate: entryGate || 'MAIN_GATE',
        },
        message: 'Session created successfully',
    });
});

/**
 * POST /api/fastag/exit
 * Closes a yard session when vehicle exits.
 * 
 * Input:
 * - fastTagId OR sessionId: Identifier for the session
 * - exitTimestamp: When vehicle left
 * - exitGate: (optional) Which gate was used
 */
export const fastagExit = asyncHandler(async (req, res) => {
    const { fastTagId, sessionId, exitTimestamp, exitGate } = req.body;

    // Find the session
    let yardSession;

    if (sessionId) {
        yardSession = await YardSession.findActiveSession(sessionId);
    } else if (fastTagId) {
        yardSession = await YardSession.findOne({
            fastTagId: fastTagId.trim(),
            sessionStatus: 'ACTIVE',
        });
    } else {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Either sessionId or fastTagId is required',
        });
    }

    if (!yardSession) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    // Close the yard session
    await yardSession.closeSession({
        exitTimestamp: exitTimestamp ? new Date(exitTimestamp) : new Date(),
        exitGate: exitGate || 'MAIN_GATE',
    });

    // Log exit event
    await EventLog.create({
        truckId: yardSession.sessionId,
        eventType: 'FASTAG_EXIT',
        message: `Vehicle ${yardSession.vehicleNumber} exited via ${exitGate || 'MAIN_GATE'}. Duration: ${yardSession.totalDuration} minutes`,
    });

    console.log(`🚪 FastTag exit: ${yardSession.vehicleNumber} (${yardSession.totalDuration} min)`);

    res.status(200).json({
        success: true,
        data: {
            sessionId: yardSession.sessionId,
            vehicleNumber: yardSession.vehicleNumber,
            totalDuration: yardSession.totalDuration,
            startTime: yardSession.startTime,
            endTime: yardSession.endTime,
            anomalyCount: yardSession.anomalyCount,
            proximityViolationCount: yardSession.proximityViolationCount,
        },
        message: 'Session closed successfully',
    });
});

/**
 * GET /api/fastag/session/:sessionId
 * Get session details by sessionId.
 */
export const getSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    const yardSession = await YardSession.findOne({ sessionId });

    if (!yardSession) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'Session not found',
        });
    }

    res.status(200).json({
        success: true,
        data: yardSession,
        message: 'Session retrieved',
    });
});

/**
 * GET /api/fastag/active
 * Get all active yard sessions.
 */
export const getActiveSessions = asyncHandler(async (req, res) => {
    const sessions = await YardSession.find({ sessionStatus: 'ACTIVE' })
        .sort({ startTime: -1 })
        .lean();

    res.status(200).json({
        success: true,
        data: sessions,
        message: `Found ${sessions.length} active sessions`,
    });
});

/**
 * POST /api/fastag/validate
 * Validates session is active (for location updates).
 * Called by mobile app before sending GPS data.
 */
export const validateSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'sessionId is required',
        });
    }

    // Check YardSession first
    const yardSession = await YardSession.findActiveSession(sessionId);

    if (yardSession) {
        return res.status(200).json({
            success: true,
            data: {
                valid: true,
                sessionId,
                vehicleNumber: yardSession.vehicleNumber,
                sessionType: 'FASTAG',
            },
            message: 'Session is valid',
        });
    }

    // Fallback: Check TruckSession for legacy UUID-based tracking
    const truckSession = await TruckSession.findOne({
        truckId: sessionId,
        state: { $ne: 'EXITED' },
    });

    if (truckSession) {
        return res.status(200).json({
            success: true,
            data: {
                valid: true,
                sessionId,
                sessionType: 'LEGACY',
            },
            message: 'Session is valid (legacy mode)',
        });
    }

    res.status(404).json({
        success: false,
        data: { valid: false },
        message: 'No active session found for this sessionId',
    });
});
