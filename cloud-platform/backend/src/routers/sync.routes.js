import express from 'express';
import { getSyncEvents } from '../controllers/sync.controller.js';

const router = express.Router();

router.get('/events', getSyncEvents);

export default router;
