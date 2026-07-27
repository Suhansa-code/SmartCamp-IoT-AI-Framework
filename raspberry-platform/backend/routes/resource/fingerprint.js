import express from 'express';
import { scan } from '../../controllers/resource/fingerprint.js';

const router = express.Router();

router.post('/scan', scan);

export default router;
