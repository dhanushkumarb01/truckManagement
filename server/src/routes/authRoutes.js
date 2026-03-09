import { Router } from 'express';
import { register, login, getMe, logout } from '../controllers/authController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

/**
 * Authentication Routes
 * 
 * POST /api/auth/register - Register new user
 * POST /api/auth/login    - Login and get JWT
 * GET  /api/auth/me       - Get current user (requires auth)
 * POST /api/auth/logout   - Logout (client-side)
 */

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);

// Protected routes (authentication required)
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
