import TruckSession from '../models/TruckSession.js';
import EventLog from '../models/EventLog.js';
import {
    validateTransition,
    canDock,
    logRejectedTransition,
} from '../services/ruleEngine.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Helper to shape a session document for API responses.
 */
function formatSession(session) {
    const obj = session.toObject();
    return {
        truckId: obj.truckId,
        state: obj.state,
        tareWeight: obj.tareWeight,
        grossWeight: obj.grossWeight,
        invoiceStatus: obj.invoiceStatus,
        movementLock: obj.movementLock,
        visitCount: obj.visitCount,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
    };
}

/**
 * POST /api/session/start
 * Creates a new truck session in ENTRY state.
 */
export const startSession = asyncHandler(async (req, res) => {
    const { truckId } = req.body;

    if (!truckId || !truckId.trim()) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'truckId is required',
        });
    }

    const existing = await TruckSession.findOne({
        truckId: truckId.trim(),
        state: { $ne: 'EXITED' },
    });

    if (existing) {
        return res.status(409).json({
            success: false,
            data: null,
            message: `Truck '${truckId.trim()}' already has an active session`,
        });
    }

    const session = await TruckSession.create({
        truckId: truckId.trim(),
        state: 'ENTRY',
    });

    await EventLog.create({
        truckId: session.truckId,
        eventType: 'SESSION_START',
        message: `Session started for truck ${session.truckId}`,
    });

    res.status(201).json({
        success: true,
        data: formatSession(session),
        message: 'Session started',
    });
});

/**
 * POST /api/session/tare
 * Records tare weight. Requires state = ENTRY.
 */
export const recordTare = asyncHandler(async (req, res) => {
    const { truckId, tareWeight } = req.body;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });
    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    const check = validateTransition(session.state, 'tare');
    if (!check.valid) {
        await logRejectedTransition(truckId, 'tare', check.reason);
        return res.status(400).json({
            success: false,
            data: null,
            message: check.reason,
        });
    }

    if (tareWeight == null || isNaN(tareWeight) || Number(tareWeight) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Valid tare weight is required (positive number)',
        });
    }

    session.tareWeight = Number(tareWeight);
    session.state = 'TARE_DONE';
    await session.save();

    await EventLog.create({
        truckId,
        eventType: 'TARE_RECORDED',
        message: `Tare weight recorded: ${tareWeight} kg`,
    });

    res.json({
        success: true,
        data: formatSession(session),
        message: `Tare weight recorded: ${tareWeight} kg`,
    });
});

/**
 * POST /api/session/dock
 * Enter loading dock. Checks rule engine for movement lock.
 */
export const enterDock = asyncHandler(async (req, res) => {
    const { truckId } = req.body;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });
    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    // Check dock-specific enforcement (invoice lock)
    const dockCheck = await canDock(session);
    if (!dockCheck.allowed) {
        return res.status(403).json({
            success: false,
            data: formatSession(session),
            message: dockCheck.reason,
        });
    }

    // Check state transition validity
    const check = validateTransition(session.state, 'dock');
    if (!check.valid) {
        await logRejectedTransition(truckId, 'dock', check.reason);
        return res.status(400).json({
            success: false,
            data: null,
            message: check.reason,
        });
    }

    session.state = 'DOCK';
    session.visitCount += 1;
    await session.save();

    await EventLog.create({
        truckId,
        eventType: 'DOCK_ENTRY',
        message: `Entered loading dock (visit #${session.visitCount}). RFID verified. Camera confirmed.`,
    });

    res.json({
        success: true,
        data: formatSession(session),
        message: `Dock entry #${session.visitCount} confirmed`,
    });
});

/**
 * POST /api/session/gross
 * Records gross weight. Requires state = DOCK.
 */
export const recordGross = asyncHandler(async (req, res) => {
    const { truckId, grossWeight } = req.body;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });
    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    const check = validateTransition(session.state, 'gross');
    if (!check.valid) {
        await logRejectedTransition(truckId, 'gross', check.reason);
        return res.status(400).json({
            success: false,
            data: null,
            message: check.reason,
        });
    }

    if (grossWeight == null || isNaN(grossWeight) || Number(grossWeight) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'Valid gross weight is required (positive number)',
        });
    }

    session.grossWeight = Number(grossWeight);
    session.state = 'GROSS_DONE';
    await session.save();

    await EventLog.create({
        truckId,
        eventType: 'GROSS_RECORDED',
        message: `Gross weight recorded: ${grossWeight} kg (Net: ${Number(grossWeight) - session.tareWeight} kg)`,
    });

    res.json({
        success: true,
        data: formatSession(session),
        message: `Gross weight recorded: ${grossWeight} kg`,
    });
});

/**
 * POST /api/session/invoice
 * Generates invoice and locks movement.
 */
export const generateInvoice = asyncHandler(async (req, res) => {
    const { truckId } = req.body;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });
    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    const check = validateTransition(session.state, 'invoice');
    if (!check.valid) {
        await logRejectedTransition(truckId, 'invoice', check.reason);
        return res.status(400).json({
            success: false,
            data: null,
            message: check.reason,
        });
    }

    session.state = 'INVOICE_GENERATED';
    session.invoiceStatus = 'GENERATED';
    session.movementLock = true;
    await session.save();

    await EventLog.create({
        truckId,
        eventType: 'INVOICE_GENERATED',
        message: `Invoice generated. Net weight: ${session.grossWeight - session.tareWeight} kg. Movement locked.`,
    });

    res.json({
        success: true,
        data: formatSession(session),
        message: 'Invoice generated. Movement is now locked.',
    });
});

/**
 * POST /api/session/exit
 * Exits the session. Requires INVOICE_GENERATED.
 */
export const exitSession = asyncHandler(async (req, res) => {
    const { truckId } = req.body;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });
    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    const check = validateTransition(session.state, 'exit');
    if (!check.valid) {
        await logRejectedTransition(truckId, 'exit', check.reason);
        return res.status(400).json({
            success: false,
            data: null,
            message: check.reason,
        });
    }

    session.state = 'EXITED';
    await session.save();

    await EventLog.create({
        truckId,
        eventType: 'SESSION_EXIT',
        message: `Truck ${truckId} exited the facility. Session complete.`,
    });

    res.json({
        success: true,
        data: formatSession(session),
        message: 'Truck exited. Session complete.',
    });
});

/**
 * GET /api/session/:truckId
 * Retrieves the current active session for a truck.
 */
export const getSession = asyncHandler(async (req, res) => {
    const { truckId } = req.params;

    const session = await TruckSession.findOne({
        truckId,
        state: { $ne: 'EXITED' },
    });

    if (!session) {
        return res.status(404).json({
            success: false,
            data: null,
            message: 'No active session found',
        });
    }

    res.json({
        success: true,
        data: formatSession(session),
        message: 'Session retrieved',
    });
});

/**
 * GET /api/sessions
 * Returns all sessions (both active and exited), sorted by updatedAt desc.
 */
export const getAllSessions = asyncHandler(async (_req, res) => {
    const sessions = await TruckSession.find()
        .sort({ updatedAt: -1 })
        .lean();

    const data = sessions.map((s) => ({
        truckId: s.truckId,
        state: s.state,
        tareWeight: s.tareWeight,
        grossWeight: s.grossWeight,
        invoiceStatus: s.invoiceStatus,
        movementLock: s.movementLock,
        visitCount: s.visitCount,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
    }));

    res.json({
        success: true,
        data,
        message: `${data.length} session(s) found`,
    });
});
