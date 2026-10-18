import express from 'express';
import disasterRoutes from './disaster.routes.js';
import educationRoutes from './education.routes.js';
import resourcesRoutes from './resources.routes.js';
import syncRoutes from './sync.routes.js';
import donationRoutes from './donations.routes.js';
import reliefRoutes from './relief.routes.js';

/**
 * Mounts all domain routers under the `/api` prefix.
 */
export default function routes() {
  const router = express.Router();

  router.use('/disaster', disasterRoutes);
  router.use('/alerts', educationRoutes);
  router.use('/resources', resourcesRoutes);
  router.use('/sync', syncRoutes);
  router.use('/donations', donationRoutes);
  router.use('/relief', reliefRoutes);

  return router;
}
