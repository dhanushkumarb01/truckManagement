/**
 * Zone Utilities for Yard Management
 * Defines 4 internal zones within the yard polygon and detection logic
 */

// Yard boundary coordinates
const YARD_BOUNDARY = {
    topLeft: [28.248830, 76.810912],
    topRight: [28.249022, 76.817142],
    bottomRight: [28.246316, 76.815363],
    bottomLeft: [28.246303, 76.810978]
};

// Computed midpoints
const MID_LAT = 28.247566;
const MID_LNG = 76.814027;

/**
 * Zone polygon coordinates (for drawing on map)
 * Each zone is a quadrant of the yard
 */
export const ZONE_POLYGONS = {
    ZONE_A: [
        YARD_BOUNDARY.topLeft,
        [YARD_BOUNDARY.topLeft[0], MID_LNG],      // Top-mid
        [MID_LAT, MID_LNG],                        // Center
        [MID_LAT, YARD_BOUNDARY.topLeft[1]]        // Left-mid
    ],
    ZONE_B: [
        [YARD_BOUNDARY.topRight[0], MID_LNG],      // Top-mid
        YARD_BOUNDARY.topRight,
        [MID_LAT, YARD_BOUNDARY.topRight[1]],      // Right-mid
        [MID_LAT, MID_LNG]                         // Center
    ],
    ZONE_C: [
        [MID_LAT, MID_LNG],                        // Center
        [MID_LAT, YARD_BOUNDARY.bottomRight[1]],   // Right-mid
        YARD_BOUNDARY.bottomRight,
        [YARD_BOUNDARY.bottomRight[0], MID_LNG]    // Bottom-mid
    ],
    ZONE_D: [
        [MID_LAT, YARD_BOUNDARY.bottomLeft[1]],    // Left-mid
        [MID_LAT, MID_LNG],                        // Center
        [YARD_BOUNDARY.bottomLeft[0], MID_LNG],    // Bottom-mid
        YARD_BOUNDARY.bottomLeft
    ]
};

/**
 * Zone colors for visual differentiation
 */
export const ZONE_COLORS = {
    ZONE_A: '#f59e0b', // Amber
    ZONE_B: '#3b82f6', // Blue
    ZONE_C: '#22c55e', // Green
    ZONE_D: '#a855f7'  // Purple
};

/**
 * Zone labels for display
 */
export const ZONE_LABELS = {
    ZONE_A: 'Zone A (Top-Left)',
    ZONE_B: 'Zone B (Top-Right)',
    ZONE_C: 'Zone C (Bottom-Right)',
    ZONE_D: 'Zone D (Bottom-Left)',
    OUTSIDE: 'Outside Yard'
};

/**
 * Point-in-polygon detection using ray casting algorithm
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @param {Array} polygon - Array of [lat, lng] coordinates forming the polygon
 * @returns {boolean} - True if point is inside polygon
 */
function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    const n = polygon.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const [yi, xi] = polygon[i];
        const [yj, xj] = polygon[j];
        
        if (((yi > lat) !== (yj > lat)) &&
            (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    
    return inside;
}

/**
 * Check if a point is inside the entire yard boundary
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean}
 */
export function isInsideYard(lat, lng) {
    const yardPolygon = [
        YARD_BOUNDARY.topLeft,
        YARD_BOUNDARY.topRight,
        YARD_BOUNDARY.bottomRight,
        YARD_BOUNDARY.bottomLeft
    ];
    return pointInPolygon(lat, lng, yardPolygon);
}

/**
 * Detect which zone a point is in
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - 'ZONE_A' | 'ZONE_B' | 'ZONE_C' | 'ZONE_D' | 'OUTSIDE'
 */
export function detectZone(lat, lng) {
    // First check if inside yard
    if (!isInsideYard(lat, lng)) {
        return 'OUTSIDE';
    }
    
    // Check each zone
    for (const [zoneName, polygon] of Object.entries(ZONE_POLYGONS)) {
        if (pointInPolygon(lat, lng, polygon)) {
            return zoneName;
        }
    }
    
    // Fallback - use simple quadrant logic if ray casting has edge issues
    if (lat >= MID_LAT && lng <= MID_LNG) return 'ZONE_A';
    if (lat >= MID_LAT && lng > MID_LNG) return 'ZONE_B';
    if (lat < MID_LAT && lng > MID_LNG) return 'ZONE_C';
    if (lat < MID_LAT && lng <= MID_LNG) return 'ZONE_D';
    
    return 'OUTSIDE';
}

/**
 * Get yard boundary as polygon coordinates array
 * @returns {Array} - Array of [lat, lng] coordinates
 */
export function getYardBoundary() {
    return [
        YARD_BOUNDARY.topLeft,
        YARD_BOUNDARY.topRight,
        YARD_BOUNDARY.bottomRight,
        YARD_BOUNDARY.bottomLeft
    ];
}
