import express from 'express';
import { checkin } from '../../controllers/resource/checkin.js';

const router = express.Router();

router.post('/', checkin);

export default router;
