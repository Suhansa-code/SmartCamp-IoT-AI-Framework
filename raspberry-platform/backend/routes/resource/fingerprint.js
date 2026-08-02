import express from 'express';
import { scan, search, link } from '../../controllers/resource/fingerprint.js';

const router = express.Router();

router.post('/scan', scan);
router.get('/search', search);
router.post('/link', link);

export default router;
