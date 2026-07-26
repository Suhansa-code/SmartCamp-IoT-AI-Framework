import express from 'express';
import { validateEnrol } from '../../middleware/validate.js';
import { enrolChild, getChild, testChildIdGeneration } from '../../controllers/child.js';

const router = express.Router();

router.post('/enrol', validateEnrol, enrolChild);
router.get('/test-id', testChildIdGeneration);
router.get('/:childId', getChild);

export default router;
