import express from 'express';
import { resolveQr, lookupQr } from '../../controllers/resource/qr.js';

const router = express.Router();

router.get('/:qr/lookup', lookupQr);
router.get('/:qr', resolveQr);

export default router;
