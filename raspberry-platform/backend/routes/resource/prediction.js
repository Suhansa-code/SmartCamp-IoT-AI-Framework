import express from 'express';
import { getInputs, getForecast, getResults, postResult } from '../../controllers/resource/prediction.js';
import { setupMqttListener } from '../../services/resource/prediction.js';

const router = express.Router();

setupMqttListener();

router.get('/inputs', getInputs);
router.get('/forecast', getForecast);
router.get('/results', getResults);
router.post('/result', postResult);

export default router;
