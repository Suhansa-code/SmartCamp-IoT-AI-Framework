import express from 'express';
import { distribute } from '../../controllers/resource/distribute.js';

const router = express.Router();

router.post('/', distribute);

export default router;
