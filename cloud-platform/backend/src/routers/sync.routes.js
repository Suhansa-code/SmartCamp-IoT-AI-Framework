import express from 'express';
import { getNetworkStatuses, getSyncEvents } from '../controllers/sync.controller.js';

const router = express.Router();

router.get('/events', getSyncEvents);
router.get('/network-status', getNetworkStatuses);

export default router;
