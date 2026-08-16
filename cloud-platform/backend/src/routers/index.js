import express from 'express';
import disasterRoutes from './disaster.routes.js';
import educationRoutes from './education.routes.js';
import resourcesRoutes from './resources.routes.js';
import networkRoutes from './network.routes.js';

/**
 * Mounts all domain routers under the `/api` prefix.
 * @param {{ monitor: object }} deps — shared service instances
 */
export default function routes({ monitor }) {
  const router = express.Router();

  router.use('/disaster', disasterRoutes);
  router.use('/alerts', educationRoutes);
  router.use('/resources', resourcesRoutes);
  router.use('/network', networkRoutes(monitor));

  return router;
}