import { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Authentication Context for RBAC
 * 
 * Provides:
 * - Current user state
 * - Login/logout functions
 * - Role checking utilities
 * 
 * Roles:
 * - superadmin: System-wide access across all yards
 * - admin: Full system access for a single yard
 * - gatekeeper: RFID Sessions page only
 */

const AuthContext = createContext(null);

// Storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ROLE_KEY = 'auth_role'; // RBAC: Separate role key for quick access

/**
 * AuthProvider component
 * Wrap your app with this to provide auth context
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize auth state from localStorage on mount
    useEffect(() => {
        try {
            const storedToken = localStorage.getItem(TOKEN_KEY);
            const storedUser = localStorage.getItem(USER_KEY);

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch (error) {
            console.error('Failed to restore auth state:', error);
            // Clear corrupted data
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(ROLE_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Login user and store credentials
     * @param {Object} userData - User object from API
     * @param {string} authToken - JWT token
     */
    const login = useCallback((userData, authToken) => {
        setUser(userData);
        setToken(authToken);
        localStorage.setItem(TOKEN_KEY, authToken);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
        localStorage.setItem(ROLE_KEY, userData.role); // RBAC: Store role separately
    }, []);

    /**
     * Logout user and clear credentials
     */
    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ROLE_KEY); // RBAC: Clear role
    }, []);

    /**
     * Check if user is authenticated
     */
    const isAuthenticated = Boolean(user && token);

    /**
     * Check if user has a specific role
     * @param {string} role - Role to check
     */
    const hasRole = useCallback((role) => {
        return user?.role === role;
    }, [user]);

    /**
     * Check if user has any of the specified roles
     * @param {...string} roles - Roles to check
     */
    const hasAnyRole = useCallback((...roles) => {
        return roles.includes(user?.role);
    }, [user]);

    /**
     * Check if user is admin
     */
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    /**
     * Check if user is superadmin
     */
    const isSuperAdmin = user?.role === 'superadmin';

    /**
     * Check if user is gatekeeper
     */
    const isGatekeeper = user?.role === 'gatekeeper';

    /**
     * Get authorization header for API requests
     */
    const getAuthHeader = useCallback(() => {
        return token ? { Authorization: `Bearer ${token}` } : {};
    }, [token]);

    const value = {
        user,
        token,
        loading,
        isAuthenticated,
        isAdmin,
        isSuperAdmin,
        isGatekeeper,
        login,
        logout,
        hasRole,
        hasAnyRole,
        getAuthHeader,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 * @returns {Object} Auth context value
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * RBAC: Route access configuration
 * Defines which roles can access which views
 * 
 * This is the central configuration for route permissions.
 * Modify this object to extend RBAC for new roles.
 */
export const ROUTE_PERMISSIONS = {
    // View name -> array of allowed roles
    yards: ['superadmin'], // Yard selection - superadmin only
    map: ['superadmin', 'admin'],
    lifecycle: ['superadmin', 'admin'],
    fleet: ['superadmin', 'admin'],
    rfid: ['superadmin', 'admin', 'gatekeeper'], // All roles can access RFID Sessions
};

/**
 * Check if a role can access a specific view
 * @param {string} role - User role
 * @param {string} view - View name
 * @returns {boolean}
 */
export function canAccessView(role, view) {
    const allowedRoles = ROUTE_PERMISSIONS[view];
    if (!allowedRoles) return false; // Unknown view - deny by default
    return allowedRoles.includes(role);
}

/**
 * Get default view for a role
 * @param {string} role - User role
 * @returns {string} Default view name
 */
export function getDefaultViewForRole(role) {
    switch (role) {
        case 'superadmin':
            return 'yards'; // Superadmin starts at yard selection
        case 'admin':
            return 'map'; // Admin starts at map
        case 'gatekeeper':
            return 'rfid'; // Gatekeeper starts at RFID Sessions
        default:
            return 'rfid'; // Default fallback
    }
}

export default AuthContext;
