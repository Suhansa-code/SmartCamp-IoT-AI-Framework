import express from 'express';
import { getPersonResourceHistory } from '../../controllers/resource/resources.js';

const router = express.Router();

router.get('/:id/resources', getPersonResourceHistory);

export default router;
