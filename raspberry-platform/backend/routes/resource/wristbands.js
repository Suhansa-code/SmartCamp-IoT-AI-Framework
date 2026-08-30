import express from 'express';
import {
  listWristbands, getWristband, createWristband, updateWristband,
  assignWristband, unassignWristband, getAssignmentHistory, getAvailableWristbands,
  getWristbandQRCode, getWristbandStats, createWristbandsBatch, exportWristbandQRSheet,
  assignWristbandByBarcode,
} from '../../controllers/resource/wristbands.js';

const router = express.Router();

router.get('/stats', getWristbandStats);
router.post('/batch', createWristbandsBatch);
router.get('/export', exportWristbandQRSheet);
router.get('/', listWristbands);
router.post('/', createWristband);
router.get('/available', getAvailableWristbands);
router.post('/assign-by-barcode', assignWristbandByBarcode);
router.get('/:id', getWristband);
router.get('/:id/qrcode', getWristbandQRCode);
router.put('/:id', updateWristband);
router.post('/:id/assign', assignWristband);
router.post('/:id/unassign', unassignWristband);
router.get('/:id/history', getAssignmentHistory);

export default router;
