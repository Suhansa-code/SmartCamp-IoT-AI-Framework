import express from 'express';
import * as ctrl from '../controllers/childController.js';
import { validateEnrol } from '../middleware/validate.js';

const router = express.Router();

// POST /api/child/enrol
router.post('/enrol', validateEnrol, ctrl.enrolChild);

// GET /api/child/:childId
router.get('/:childId', ctrl.getChild);

export default router;