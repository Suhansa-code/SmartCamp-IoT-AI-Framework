
'use strict';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import logger from './utils/logger.js';
import C from './config/constants.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import childRoutes from './routes/child.js';
import sessionRoutes from './routes/session.js';
import dashboardRoutes from './routes/dashboard.js';
import syncRoutes from './routes/sync.js';

const app = express();

const isAllowedOrigin = (origin) => {
  if (C.CORS_ORIGINS.includes(origin)) {
    return true;
  }

  if (!C.ALLOW_VERCEL_PREVIEWS) {
    return false;
  }

  try {
    const parsedOrigin = new URL(origin);
    return (
      parsedOrigin.protocol === 'https:'
      && /(^|\.)vercel\.app$/i.test(parsedOrigin.hostname)
    );
  } catch {
    return false;
  }
};

//Security headers
app.use(helmet({
  contentSecurityPolicy: false,
}));

//CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman in dev)
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    logger.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

//Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

//Request logger
app.use((req, _res, next) => {
  logger.debug(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// Call tursoconfig to check it works using tursoConfig
import { pgIsReachable } from './config/tursoConfig.js';

pgIsReachable()
  .then(() => logger.info('[TURSO] Initial connection test successful'))
  .catch((err) => logger.error(`[TURSO] Initial connection test failed: ${err.message}`));



// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    device: C.DEVICE_ID,
    camp:   C.CAMP_ID,
    time:   new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
// Child-facing (no auth)
app.use('/api/child',childRoutes);
app.use('/api/session', sessionRoutes);

// Auth + admin dashboard (JWT required on protected routes)
// Note: /api/auth/admin/login lives inside dashboardRoutes but is public
app.use('/api',dashboardRoutes);

// Sync (internal, no external auth)
app.use('/api/sync',syncRoutes);

// ── 404 + error handler ───────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;