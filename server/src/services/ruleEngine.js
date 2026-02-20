import EventLog from '../models/EventLog.js';

/**
 * State transition rules. Maps each action to the set of valid current states.
 */
const TRANSITION_MAP = {
    tare: ['ENTRY'],
    dock: ['TARE_DONE', 'GROSS_DONE'],
    gross: ['DOCK'],
    invoice: ['GROSS_DONE'],
    exit: ['INVOICE_GENERATED'],
};

/**
 * Validates whether a state transition is allowed.
 * Does NOT mutate the session — purely a check.
 *
 * @param {string} currentState - The session's current state
 * @param {string} action - The action being attempted
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateTransition(currentState, action) {
    const allowedStates = TRANSITION_MAP[action];

    if (!allowedStates) {
        return { valid: false, reason: `Unknown action: ${action}` };
    }

    if (!allowedStates.includes(currentState)) {
        return {
            valid: false,
            reason: `Cannot perform '${action}' from state '${currentState}'. Required state(s): ${allowedStates.join(', ')}`,
        };
    }

    return { valid: true };
}

/**
 * Dock-specific enforcement logic.
 * Before invoice: allow unlimited dock visits.
 * After invoice: block, create VIOLATION event, do NOT increment visitCount.
 *
 * @param {Object} session - The TruckSession document
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function canDock(session) {
    if (session.invoiceStatus === 'GENERATED' || session.movementLock) {
        const reason =
            'Movement restricted: Invoice already generated. Dock re-entry is not permitted.';

        await EventLog.create({
            truckId: session.truckId,
            eventType: 'VIOLATION',
            message: reason,
        });

        return { allowed: false, reason };
    }

    return { allowed: true };
}

/**
 * Logs a rejected transition attempt as an event.
 *
 * @param {string} truckId
 * @param {string} action
 * @param {string} reason
 */
export async function logRejectedTransition(truckId, action, reason) {
    await EventLog.create({
        truckId,
        eventType: 'REJECTED',
        message: `Action '${action}' rejected: ${reason}`,
    });
}
