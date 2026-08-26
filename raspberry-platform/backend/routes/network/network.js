import express from 'express';
import { getState, getStatus, setState, flush, testPublish } from '../../controllers/network/network.js';

const router = express.Router();

router.get('/state', getState);
router.get('/status', getStatus);
router.post('/state', setState);
router.post('/flush', flush);
router.post('/test-publish', testPublish);

export default router;
