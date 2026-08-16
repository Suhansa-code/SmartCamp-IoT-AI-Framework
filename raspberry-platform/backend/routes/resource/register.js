import express from 'express';
import {
  register, getAllPersons, getPersonById,
  updatePerson, deactivatePerson, getCheckinsByPersonId, getPersonQr,
} from '../../controllers/resource/register.js';

const router = express.Router();

router.get('/', getAllPersons);
router.get('/:id', getPersonById);
router.get('/:id/checkins', getCheckinsByPersonId);
router.get('/:id/qrcode', getPersonQr);
router.post('/', register);
router.put('/:id', updatePerson);
router.delete('/:id', deactivatePerson);

export default router;
