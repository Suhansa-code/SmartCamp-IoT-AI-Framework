import express from 'express';
import { getState, getStatus, setState, flush } from '../../controllers/network/network.js';

const router = express.Router();

router.get('/state', getState);
router.get('/status', getStatus);
router.post('/state', setState);
router.post('/flush', flush);

export default router;
