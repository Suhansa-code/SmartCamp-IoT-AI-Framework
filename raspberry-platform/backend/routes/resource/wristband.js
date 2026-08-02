import express from 'express';
import { getWristband, getDistributionHistory } from '../../controllers/resource/wristband.js';

const router = express.Router();

router.get('/:barcode', getWristband);
router.get('/:barcode/history', getDistributionHistory);

export default router;
