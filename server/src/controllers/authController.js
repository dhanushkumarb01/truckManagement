import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token for user
 * @param {Object} user - User document
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        {
            userId: user._id,
            email: user.email,
            role: user.role,
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * POST /api/auth/register
 * Register a new user
 * 
 * Body: { name, email, password, role? }
 * Note: In production, admin registration should be restricted
 */
export async function register(req, res) {
    try {
        const { name, email, password, role } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Name, email, and password are required.',
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                data: null,
                message: 'User with this email already exists.',
            });
        }

        // Validate role if provided
        if (role && !User.ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                data: null,
                message: `Invalid role. Allowed roles: ${User.ROLES.join(', ')}`,
            });
        }

        // Create new user
        const user = new User({
            name,
            email,
            password,
            role: role || 'gatekeeper', // Default to gatekeeper
        });

        await user.save();

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            success: true,
            data: {
                user: user.toSafeObject(),
                token,
            },
            message: 'User registered successfully.',
        });
    } catch (error) {
        console.error('Registration error:', error);

        // Handle mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                data: null,
                message: messages.join('. '),
            });
        }

        res.status(500).json({
            success: false,
            data: null,
            message: 'Registration failed. Please try again.',
        });
    }
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT
 * 
 * Body: { email, password }
 */
export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                data: null,
                message: 'Email and password are required.',
            });
        }

        // Find user by email (include password for comparison)
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Invalid email or password.',
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                data: null,
                message: 'Account is deactivated. Contact administrator.',
            });
        }

        // Verify password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                data: null,
                message: 'Invalid email or password.',
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user);

        res.json({
            success: true,
            data: {
                user: user.toSafeObject(),
                token,
            },
            message: 'Login successful.',
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            data: null,
            message: 'Login failed. Please try again.',
        });
    }
}

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 * Requires: authenticate middleware
 */
export async function getMe(req, res) {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                data: null,
                message: 'User not found.',
            });
        }

        res.json({
            success: true,
            data: user.toSafeObject(),
            message: 'User profile retrieved.',
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            data: null,
            message: 'Failed to retrieve profile.',
        });
    }
}

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 * Note: JWT tokens are stateless, so this is just for logging/confirmation
 */
export async function logout(req, res) {
    // In a stateless JWT system, logout is handled client-side
    // This endpoint can be used for audit logging if needed
    res.json({
        success: true,
        data: null,
        message: 'Logged out successfully. Please remove token from client.',
    });
}

export default { register, login, getMe, logout };
