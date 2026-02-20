const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling.
 * Never throws — always returns { success, data, message }.
 */
async function request(url, options = {}) {
    try {
        const res = await fetch(`${API_BASE}${url}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options,
        });
        const json = await res.json();
        return json;
    } catch {
        return {
            success: false,
            data: null,
            message: 'Backend connection failed. Please ensure the server is running.',
        };
    }
}

export function startSession(truckId) {
    return request('/session/start', {
        method: 'POST',
        body: JSON.stringify({ truckId }),
    });
}

export function recordTare(truckId, tareWeight) {
    return request('/session/tare', {
        method: 'POST',
        body: JSON.stringify({ truckId, tareWeight: Number(tareWeight) }),
    });
}

export function enterDock(truckId) {
    return request('/session/dock', {
        method: 'POST',
        body: JSON.stringify({ truckId }),
    });
}

export function recordGross(truckId, grossWeight) {
    return request('/session/gross', {
        method: 'POST',
        body: JSON.stringify({ truckId, grossWeight: Number(grossWeight) }),
    });
}

export function generateInvoice(truckId) {
    return request('/session/invoice', {
        method: 'POST',
        body: JSON.stringify({ truckId }),
    });
}

export function exitSession(truckId) {
    return request('/session/exit', {
        method: 'POST',
        body: JSON.stringify({ truckId }),
    });
}

export function getSession(truckId) {
    return request(`/session/${encodeURIComponent(truckId)}`);
}

export function getEvents(truckId) {
    return request(`/events/${encodeURIComponent(truckId)}`);
}

export function getAllSessions() {
    return request('/sessions');
}
