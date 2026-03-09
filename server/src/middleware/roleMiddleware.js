/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Use after authenticate middleware to restrict routes by role.
 * 
 * Role Hierarchy:
 * - superadmin: System-wide access across all yards
 * - admin: Full access to all routes within a yard
 * - gatekeeper: Limited access (RFID sessions only)
 * 
 * Future expansion:
 * - clientadmin: Client-level access
 * - locationadmin: Location-specific access
 */

/**
 * Require specific role(s) to access a route
 * @param {...string} allowedRoles - Roles that can access this route
 * @returns {Function} Express middleware
 * 
 * Usage:
 *   router.get('/admin-only', authenticate, requireRole('admin'), handler);
 *   router.get('/multi-role', authenticate, requireRole('admin', 'gatekeeper'), handler);
 */
export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        // Must be authenticated first
        if (!req.user) {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Authentication required.',
            });
        }

        const userRole = req.user.role;

        // Check if user's role is in allowed roles
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                data: null,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}.`,
            });
        }

        next();
    };
}

/**
 * Require admin or superadmin role
 * Shorthand for requireRole('admin', 'superadmin')
 */
export function requireAdmin(req, res, next) {
    return requireRole('admin', 'superadmin')(req, res, next);
}

/**
 * Require gatekeeper, admin, or superadmin role
 * Shorthand for requireRole('admin', 'superadmin', 'gatekeeper')
 */
export function requireGatekeeperAccess(req, res, next) {
    return requireRole('admin', 'superadmin', 'gatekeeper')(req, res, next);
}

/**
 * Check if user has at least one of the specified roles
 * Returns boolean (does not send response)
 * @param {Object} user - User object from req.user
 * @param {...string} roles - Roles to check
 * @returns {boolean}
 */
export function hasRole(user, ...roles) {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
}

export default requireRole;
