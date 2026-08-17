import express from 'express';
import { getMetrics, getState } from '../controllers/network/network.controller.js';

export default function networkRoutes(monitor) {
  const router = express.Router();

  router.get('/metrics', (req, res) => getMetrics(monitor, req, res));
  router.get('/state', (req, res) => getState(monitor, req, res));

  return router;
}