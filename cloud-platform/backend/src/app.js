import express from 'express';
import cors from 'cors';
import routes from './routers/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { requestLogger } from './middleware/requestLogger.js';

/**
 * Builds and configures the Express application.
 * Kept free of side effects so it can be reused by tests.
 */
export function createApp() {
  const app = express();

  app.use(cors());
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
