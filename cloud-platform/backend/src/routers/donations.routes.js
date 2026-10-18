import express from 'express';
import {
  createInKindDonation, getConfig, getCurrentDonor, getNeeds, googleSignIn, signOut, startCheckout,
} from '../controllers/donation/donation.controller.js';
import { requireDonor } from '../services/donation/auth.service.js';

const router = express.Router();

router.get('/config', getConfig);
router.get('/needs', getNeeds);
router.get('/auth/me', getCurrentDonor);
router.post('/auth/google', googleSignIn);
router.post('/auth/logout', signOut);
router.post('/in-kind', createInKindDonation);
router.post('/checkout', requireDonor, startCheckout);

export default router;
