import express from 'express';
import {
  scan, search, link, unlink, enroll, cancelEnroll, confirmEnroll, status, nextSlot, events,
} from '../../controllers/resource/fingerprint.js';

const router = express.Router();

router.get('/events', events);
router.get('/status', status);
router.get('/next-slot', nextSlot);
router.get('/search', search);
router.post('/scan', scan);
router.post('/enroll', enroll);
router.post('/enroll/cancel', cancelEnroll);
router.post('/enroll/confirm', confirmEnroll);
router.post('/link', link);
router.post('/unlink', unlink);

export default router;
