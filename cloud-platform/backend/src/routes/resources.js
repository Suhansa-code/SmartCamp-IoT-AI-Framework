// Resources API — exposes camp stats and resource prediction to the admin dashboard.
// Data flows: Pi → EMQX → campDataService (in-memory) → these routes.

import express         from 'express';
import { getOverview } from '../services/campDataService.js';

const router = express.Router();

// GET /api/resources/overview
// Returns population, distribution progress, prediction, event feed — everything.
router.get('/overview', (_req, res) => {
  res.json(getOverview());
});

export default router;
