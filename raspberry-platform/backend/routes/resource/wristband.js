import express from 'express';
import { getWristband } from '../../controllers/resource/wristband.js';

const router = express.Router();

router.get('/:barcode', getWristband);

export default router;
