import express from 'express';
import { getCamps, getCampById, getPredictionModels, getOverview, getGpsLocation } from '../../controllers/disaster/disaster.js';

const router = express.Router();
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

router.get('/camps', getCamps);
router.get('/camps/:id', getCampById);
router.get('/prediction-models', getPredictionModels);
router.get('/overview', getOverview);
router.get('/gps', getGpsLocation);

router.get('/gauging-station', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const response = await fetch(`${EDGE_API}/hydrospatial/nearest-river-gauging-station?lat=${lat}&lon=${lon}`);
    if (!response.ok) throw new Error(`Edge gateway returned ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

export default router;
