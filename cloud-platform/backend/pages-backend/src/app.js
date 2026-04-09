
'use strict';

require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const logger     = require('./utils/logger');
const C          = require('./config/constants');
const { nowISO } = require('./utils/helpers');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Route modules 
const childRoutes     = require('./routes/child');
const sessionRoutes   = require('./routes/session');
const dashboardRoutes = require('./routes/dashboard');
const syncRoutes      = require('./routes/sync');

const app = express();

// Security headers 
app.use(helmet({
  // Content-Security-Policy is relaxed for the local RPi environment
  contentSecurityPolicy: false,
}));

// Flask is on localhost — it does not hit these routes.
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, Postman in dev)
    if (!origin) return callback(null, true);
    if (C.CORS_ORIGINS.includes(origin)) return callback(null, true);
    logger.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods:     ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsers 
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Request logger 
app.use((req, _res, next) => {
  logger.debug(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// Health check 
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    device: C.DEVICE_ID,
    camp:   C.CAMP_ID,
    time:   nowISO(),
  });
});

// Routes 
// Child-facing (no auth)
app.use('/api/child',   childRoutes);
app.use('/api/session', sessionRoutes);

// Auth + admin dashboard (JWT required on protected routes)
// Note: /api/auth/admin/login lives inside dashboardRoutes but is public
app.use('/api',         dashboardRoutes);

// Sync (internal, no external auth)
app.use('/api/sync',    syncRoutes);

// 404 + error handler 
app.use(notFound);
app.use(errorHandler);

module.exports = app;