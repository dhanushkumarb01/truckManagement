import { Router } from 'express';
import {
    startSession,
    recordTare,
    enterDock,
    recordGross,
    generateInvoice,
    exitSession,
    getSession,
    getAllSessions,
} from '../controllers/sessionController.js';

const router = Router();

router.post('/start', startSession);
router.post('/tare', recordTare);
router.post('/dock', enterDock);
router.post('/gross', recordGross);
router.post('/invoice', generateInvoice);
router.post('/exit', exitSession);
router.get('/:truckId', getSession);

export { getAllSessions };
export default router;
