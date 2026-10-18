import express from 'express';
import cors from 'cors';
import routes from './routers/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';
import { stripeWebhook } from './controllers/donation/donation.controller.js';
import { webhookHandler } from './controllers/relief/relief.controller.js';

/**
 * Builds and configures the Express application.
 * Kept free of side effects so it can be reused by tests.
 */
export function createApp() {
  const app = express();

  app.use(cors());
  // Webhooks need the raw body for signature verification, so they are
  // mounted before express.json().
  app.post('/api/donations/webhook/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
  app.post('/api/relief/webhooks/payhere', express.urlencoded({ extended: false }), webhookHandler('PAYHERE'));
  app.post('/api/relief/webhooks/stripe', express.raw({ type: 'application/json' }), webhookHandler('STRIPE'));
  app.post('/api/relief/webhooks/sandbox', express.raw({ type: 'application/json' }), webhookHandler('SANDBOX'));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', routes());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
