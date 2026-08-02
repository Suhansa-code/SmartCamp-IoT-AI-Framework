import express from 'express';
import { register, getAllPersons } from '../../controllers/resource/register.js';

const router = express.Router();

router.get('/', getAllPersons);
router.post('/', register);

export default router;
