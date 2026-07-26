import express from 'express';
import { triggerSync, getSyncStatus } from '../../controllers/sync.js';

const router = express.Router();

router.post('/trigger', triggerSync);
router.get('/status', getSyncStatus);

export default router;
