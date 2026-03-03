// Use relative path in development (Vite proxy), absolute URL in production
const API_BASE = import.meta.env.PROD 
    ? 'https://truckmanagement-r1vo.onrender.com/api' 
    : '/api';

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

/**
 * GET /api/events
 * Returns all GPS location events.
 */
export function getGpsEvents() {
    return request('/events');
}

// ============ ZONE MANAGEMENT API ============

/**
 * GET /api/zones
 * Fetch all zones for the yard.
 */
export function getZones(yardId = 'DEFAULT_YARD') {
    return request(`/zones?yardId=${encodeURIComponent(yardId)}`);
}

/**
 * POST /api/zones
 * Create a new zone.
 */
export function createZone(zoneData) {
    return request('/zones', {
        method: 'POST',
        body: JSON.stringify(zoneData),
    });
}

/**
 * PUT /api/zones/:zoneId
 * Update an existing zone.
 */
export function updateZone(zoneId, zoneData) {
    return request(`/zones/${encodeURIComponent(zoneId)}`, {
        method: 'PUT',
        body: JSON.stringify(zoneData),
    });
}

/**
 * DELETE /api/zones/:zoneId
 * Delete a zone.
 */
export function deleteZone(zoneId) {
    return request(`/zones/${encodeURIComponent(zoneId)}`, {
        method: 'DELETE',
    });
}

/**
 * GET /api/zones/current
 * Get current zone for all trucks.
 */
export function getCurrentTruckZones() {
    return request('/zones/current');
}

/**
 * GET /api/zones/transitions/recent
 * Get recent zone transitions.
 */
export function getRecentTransitions(limit = 100) {
    return request(`/zones/transitions/recent?limit=${limit}`);
}

// ============ ALERTS API ============

/**
 * GET /api/alerts/dashboard
 * Get combined alert summary.
 */
export function getDashboardAlerts(limit = 20) {
    return request(`/alerts/dashboard?limit=${limit}`);
}

/**
 * GET /api/alerts/proximity
 * Get proximity violation alerts.
 */
export function getProximityAlerts(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.unacknowledged) params.append('unacknowledged', 'true');
    if (options.severity) params.append('severity', options.severity);
    return request(`/alerts/proximity?${params.toString()}`);
}

/**
 * GET /api/alerts/anomalies
 * Get anomaly alerts.
 */
export function getAnomalyAlerts(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.append('limit', options.limit);
    if (options.unresolved) params.append('unresolved', 'true');
    if (options.anomalyType) params.append('anomalyType', options.anomalyType);
    if (options.severity) params.append('severity', options.severity);
    return request(`/alerts/anomalies?${params.toString()}`);
}

/**
 * POST /api/alerts/proximity/:id/acknowledge
 * Acknowledge a proximity alert.
 */
export function acknowledgeProximityAlert(id, data = {}) {
    return request(`/alerts/proximity/${id}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * POST /api/alerts/anomalies/:id/acknowledge
 * Acknowledge an anomaly alert.
 */
export function acknowledgeAnomalyAlert(id, data = {}) {
    return request(`/alerts/anomalies/${id}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

// ============ VEHICLE MANAGEMENT API ============

/**
 * GET /api/vehicles
 * List all registered vehicles.
 */
export function getVehicles(options = {}) {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.search) params.append('search', options.search);
    return request(`/vehicles?${params.toString()}`);
}

/**
 * POST /api/vehicles
 * Register a new vehicle.
 */
export function createVehicle(vehicleData) {
    return request('/vehicles', {
        method: 'POST',
        body: JSON.stringify(vehicleData),
    });
}

/**
 * PUT /api/vehicles/:vehicleNumber
 * Update vehicle details.
 */
export function updateVehicle(vehicleNumber, vehicleData) {
    return request(`/vehicles/${encodeURIComponent(vehicleNumber)}`, {
        method: 'PUT',
        body: JSON.stringify(vehicleData),
    });
}

// ============ FASTAG API ============

/**
 * GET /api/fastag/active
 * Get all active FastTag sessions.
 */
export function getActiveFastagSessions() {
    return request('/fastag/active');
}

/**
 * POST /api/fastag/entry
 * Create session from FastTag entry (for testing/simulation).
 */
export function fastagEntry(data) {
    return request('/fastag/entry', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

