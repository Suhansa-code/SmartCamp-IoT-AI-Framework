import express from 'express';
import { validateEnrol } from '../../middleware/validate.js';
import {
  enrolChild, getChild, testChildIdGeneration,
  getChildDirectory, getChildEducation, saveLanguagePreference, getChildQRCode,
} from '../../controllers/education/child.js';

const router = express.Router();

router.post('/enrol', validateEnrol, enrolChild);
router.get('/test-id', testChildIdGeneration);
router.get('/list', getChildDirectory);
router.post('/language', saveLanguagePreference);
router.get('/:childId/qrcode', getChildQRCode);
router.get('/:childId/education', getChildEducation);
router.get('/:childId', getChild);

export default router;
