import express from 'express';
import { getCamps, getCampById, getPredictionModels, getOverview, getGpsLocation, getCampIdentity, getLatestGpsLocation, getLatestWeatherData, getWeatherStatus } from '../../controllers/disaster/disaster.js';
import * as gpsService from '../../services/disaster/gps.js';

const router = express.Router();
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

router.get('/camps', getCamps);
router.get('/camps/:id', getCampById);
router.get('/prediction-models', getPredictionModels);
router.get('/overview', getOverview);
router.get('/gps', getGpsLocation);
router.get('/latest-gps', getLatestGpsLocation);
router.get('/camp-identity', getCampIdentity);

router.get('/live-payload', async (req, res) => {
  const { lat, lon, alt } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const response = await fetch(`${EDGE_API}/hydrospatial/live-payload?lat=${lat}&lon=${lon}&alt=${alt || 10}`);
    if (!response.ok) throw new Error(`Edge gateway returned ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/predict', async (req, res) => {
  const { lat, lon, alt } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required' });
  try {
    const response = await fetch(`${EDGE_API}/hydrospatial/predict?lat=${lat}&lon=${lon}&alt=${alt || 10}`);
    if (!response.ok) throw new Error(`Edge gateway returned ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/device-status', async (_req, res) => {
  try {
    const response = await fetch(`${EDGE_API}/api/device-status`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Edge gateway returned ${response.status}`);
    const data = await response.json();

    data.camp_id = gpsService.getDynamicCampId();
    if (data.sensors?.gps && !('district' in data.sensors.gps)) {
      data.sensors.gps.district = null;
    }

    res.json(data);
  } catch (err) {
    const ts = new Date().toISOString();
    res.json({
      camp_id: gpsService.getDynamicCampId(),
      device: { id: 'edge-gateway', status: 'disconnected', uptime_note: err.message },
      sensors: {
        gps:        { connected: false, status: 'disconnected', latitude: null, longitude: null, altitude: null, satellites: 0, location_name: null, district: null, is_mock: false, source: 'UNAVAILABLE', timestamp: ts },
        temperature:{ connected: false, status: 'disconnected', value: null, unit: 'C', error: 'Edge gateway unreachable', timestamp: ts },
        humidity:   { connected: false, status: 'disconnected', value: null, unit: '%', error: 'Edge gateway unreachable', timestamp: ts },
      },
      timestamp: ts,
    });
  }
});

router.get('/weather/latest', getLatestWeatherData);
router.get('/weather/status', getWeatherStatus);

export default router;
