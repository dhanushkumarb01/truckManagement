/**
 * FastTag Routes
 * POST /api/fastag/entry - Create session from FastTag entry
 * POST /api/fastag/exit - Close session on exit
 * GET /api/fastag/session/:sessionId - Get session details
 * GET /api/fastag/active - List active sessions
 * POST /api/fastag/validate - Validate session is active
 */

import { Router } from 'express';
import {
    fastagEntry,
    fastagExit,
    getSession,
    getActiveSessions,
    validateSession,
} from '../controllers/fastagController.js';

const router = Router();

router.post('/entry', fastagEntry);
router.post('/exit', fastagExit);
router.get('/session/:sessionId', getSession);
router.get('/active', getActiveSessions);
router.post('/validate', validateSession);

export default router;
