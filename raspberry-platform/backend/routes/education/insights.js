import express from 'express';
import { getEducationInsights } from '../../controllers/education/insights.js';

const router = express.Router();

router.get('/insights', getEducationInsights);

export default router;
