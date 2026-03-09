// Use environment variable or fallback to relative path (Vite proxy)
// In production: Set VITE_API_BASE_URL in .env.production
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

// ============ DEMO MOVE MODE ============

/**
 * POST /api/location
 * Send a GPS location update (used by Demo Move Mode).
 */
export function sendLocation(data) {
    return request('/location', {
        method: 'POST',
        body: JSON.stringify(data),
    });
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

/**
 * DELETE /api/events
 * Permanently delete all event logs.
 */
export function deleteAllEvents() {
    return request('/events', {
        method: 'DELETE',
    });
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

/**
 * DELETE /api/zones/transitions
 * Permanently delete all zone transition logs.
 */
export function deleteZoneTransitions() {
    return request('/zones/transitions', {
        method: 'DELETE',
    });
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
 * Generic alerts getter - routes to appropriate endpoint based on type.
 * Used by dashboard panels.
 */
export async function getAlerts(options = {}) {
    const { type, limit = 50 } = options;

    // For zone transitions, use the transitions endpoint
    if (type === 'zone_transition') {
        const res = await getRecentTransitions(limit);
        if (res.success && Array.isArray(res.data)) {
            // Transform to alert-like format
            return {
                success: true,
                data: res.data.map(t => ({
                    _id: t._id,
                    type: 'zone_transition',
                    truckId: t.truckId || t.vehicleId,
                    fromZone: t.fromZone,
                    toZone: t.toZone,
                    timestamp: t.timestamp,
                    message: `${t.truckId || t.vehicleId} moved from ${t.fromZone || 'unknown'} to ${t.toZone || 'unknown'}`
                }))
            };
        }
        return res;
    }

    // Default: use dashboard endpoint
    return getDashboardAlerts(limit);
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

/**
 * DELETE /api/alerts/all
 * Permanently delete all alerts (proximity + anomaly).
 */
export function deleteAllAlerts() {
    return request('/alerts/all', {
        method: 'DELETE',
    });
}

/**
 * DELETE /api/alerts/proximity
 * Permanently delete all proximity alerts.
 */
export function deleteProximityAlerts() {
    return request('/alerts/proximity', {
        method: 'DELETE',
    });
}

/**
 * DELETE /api/alerts/anomalies
 * Permanently delete all anomaly alerts.
 */
export function deleteAnomalyAlerts() {
    return request('/alerts/anomalies', {
        method: 'DELETE',
    });
}

/**
 * POST /api/alerts/tamper
 * Report a tamper event from the mobile device.
 * @param {Object} data - Tamper event data
 * @param {string} data.vehicleNumber - Vehicle number
 * @param {string} data.eventType - One of: DEVICE_REMOVED, BLE_DISCONNECTED, MAGNETIC_DEVICE_REMOVED, DEVICE_OFFLINE
 * @param {string} [data.deviceId] - Optional device identifier
 * @param {Object} [data.details] - Optional additional details
 */
export function reportTamperEvent(data) {
    return request('/alerts/tamper', {
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

// ============ RFID SCAN API ============

/**
 * POST /api/rfid/scan
 * Simulate RFID/FastTag scan at gate.
 * Returns QR code for driver to scan.
 */
export function rfidScan(data) {
    return request('/rfid/scan', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * POST /api/session/link-device
 * Link driver's device to session using 6-digit driver code.
 * Called by driver APK.
 * @param {string} driverCode - 6-digit numeric code
 * @param {string} deviceId - Device identifier from phone
 */
export function linkDevice(driverCode, deviceId) {
    return request('/session/link-device', {
        method: 'POST',
        body: JSON.stringify({ driverCode, deviceId }),
    });
}

/**
 * GET /api/rfid/status/:sessionId
 * Check session status after QR scan.
 */
export function getRfidSessionStatus(sessionId) {
    return request(`/rfid/status/${encodeURIComponent(sessionId)}`);
}

// ============ YARD CONFIGURATION API ============

/**
 * GET /api/yard-config
 * Get yard configuration from database.
 */
export function getYardConfigFromServer() {
    return request('/yard-config');
}

/**
 * PUT /api/yard-config
 * Update yard configuration including polygon boundary.
 */
export function updateYardConfig(config) {
    return request('/yard-config', {
        method: 'PUT',
        body: JSON.stringify(config),
    });
}

// ============ AUTHENTICATION API ============
// RBAC: Authentication endpoints for login/register

/**
 * POST /api/auth/login
 * Authenticate user and get JWT token.
 * @param {string} email - User email
 * @param {string} password - User password
 */
export function loginUser(email, password) {
    return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
}

/**
 * POST /api/auth/register
 * Register a new user.
 * @param {Object} userData - { name, email, password, role? }
 */
export function registerUser(userData) {
    return request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
    });
}

/**
 * GET /api/auth/me
 * Get current authenticated user profile.
 * Requires Authorization header.
 * @param {string} token - JWT token
 */
export function getCurrentUser(token) {
    return request('/auth/me', {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
}

/**
 * POST /api/auth/logout
 * Logout user (for audit logging).
 * @param {string} token - JWT token
 */
export function logoutUser(token) {
    return request('/auth/logout', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
}
