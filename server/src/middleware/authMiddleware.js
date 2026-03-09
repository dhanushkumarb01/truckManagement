import jwt from 'jsonwebtoken';

/**
 * Authentication Middleware
 * 
 * Validates JWT token from Authorization header.
 * Attaches decoded user info to req.user.
 * 
 * Header format: Authorization: Bearer <token>
 */

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-change-in-production';

/**
 * Verify JWT and attach user to request
 */
export function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Access denied. No token provided.',
            });
        }

        // Expect "Bearer <token>"
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Invalid token format. Use: Bearer <token>',
            });
        }

        const token = parts[1];
        
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Attach user info to request for downstream use
        req.user = {
            userId: decoded.userId,
            role: decoded.role,
            email: decoded.email,
        };
        
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Token expired. Please login again.',
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Invalid token.',
            });
        }
        
        return res.status(500).json({
            success: false,
            data: null,
            message: 'Authentication failed.',
        });
    }
}

/**
 * Optional authentication - does not fail if no token
 * Useful for routes that work for both authenticated and anonymous users
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        req.user = null;
        return next();
    }
    
    try {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            const decoded = jwt.verify(parts[1], JWT_SECRET);
            req.user = {
                userId: decoded.userId,
                role: decoded.role,
                email: decoded.email,
            };
        }
    } catch {
        req.user = null;
    }
    
    next();
}

export default authenticate;
