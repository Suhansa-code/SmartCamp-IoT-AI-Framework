import express from 'express';
import { getResourceOverview } from '../controllers/resources/campResource.controller.js';

const router = express.Router();

router.get('/overview', getResourceOverview);

export default router;