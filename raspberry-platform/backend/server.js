import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketServer } from 'socket.io';
import C from './config/constants.js';
import logger from './utils/logger.js';
import { initializeCampDb } from './config/database.js';
import { connect as mqttConnect } from './services/network/saamp-mqtt.js';
import { startConnectivityWatcher } from './services/network/connectivity.js';
import { initFingerprintHardware } from './services/resource/fingerprint.js';
import { setSocketServer } from './services/resource/fingerprint-events.js';
import { checkFlaskHealth } from './services/education/scoring.js';
import { startSync } from './services/sync/sync-manager.js';
import { startGpsStorage } from './services/disaster/gps-storage.js';
import { startWeatherStorage } from './services/disaster/weather-storage.js';
import { startRainfallStorage } from './services/disaster/rainfall-storage.js';
import { startDht11Storage } from './services/disaster/dht11-storage.js';
import { notFound, errorHandler } from './middleware/error-handler.js';

// Camp routes
import fingerprintRoute from './routes/resource/fingerprint.js';
import checkinRoute from './routes/resource/checkin.js';
import registerRoute from './routes/resource/register.js';
import wristbandRoute from './routes/resource/wristband.js';
import wristbandsRoute from './routes/resource/wristbands.js';
import distributeRoute from './routes/resource/distribute.js';
import networkRoute from './routes/network/network.js';
import statsRoute from './routes/resource/stats.js';
import predictionRoute from './routes/resource/prediction.js';
import disasterRoute from './routes/disaster/disaster.js';
import qrRoute from './routes/resource/qr.js';
import resourcesRoute from './routes/resource/resources.js';
import personsRoute from './routes/resource/persons.js';

// Education routes
import childRoute from './routes/education/child.js';
import sessionRoute from './routes/education/session.js';
import dashboardRoute from './routes/education/dashboard.js';

const app = express();
const PORT = C.PORT;
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: C.CORS_ORIGINS,
    credentials: true,
  },
});
setSocketServer(io);
app.set('io', io);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS
const isAllowedOrigin = (origin) => {
  if (C.CORS_ORIGINS.includes(origin)) return true;
  if (!C.ALLOW_VERCEL_PREVIEWS) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.protocol === 'https:' && /(^|\.)vercel\.app$/i.test(parsedOrigin.hostname);
  } catch { return false; }
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    logger.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, _res, next) => {
  logger.debug(`→ ${req.method} ${req.originalUrl}`);
  next();
});

// Initialize camp database
initializeCampDb();

// Connect to MQTT broker
mqttConnect();

// Check Flask health at startup
checkFlaskHealth().then(healthy => {
  if (healthy) logger.info(`[FLASK] Connected to ${C.FLASK_URL}`);
  else logger.warn(`[FLASK] ${C.FLASK_URL} is unreachable — fallback scoring will be used`);
}).catch(() => {});

// Start connectivity watcher
startConnectivityWatcher();

// Start cloud sync (after MQTT connects)
startSync();


// Start periodic GPS storage to disaster.db
startGpsStorage();

// Start periodic weather forecast storage via EDGE Gateway
startWeatherStorage();

// Start periodic rainfall sensor storage from Edge Gateway
startRainfallStorage();

// Start periodic DHT11 sensor storage from Edge Gateway
startDht11Storage();
// Bring up the fingerprint scanner (no-op when disabled or unplugged)
initFingerprintHardware().catch(err => logger.error(`[FP] Init failed: ${err.message}`));

// ── Unified Health Check ─────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'smartcamp-backend', device: C.DEVICE_ID, camp: C.CAMP_ID });
});

// ── Camp Operations Routes ───────────────────────────────────
app.use('/api/fingerprint', fingerprintRoute);
app.use('/api/checkin', checkinRoute);
app.use('/api/register', registerRoute);
app.use('/api/wristband', wristbandRoute);
app.use('/api/wristbands', wristbandsRoute);
app.use('/api/distribute', distributeRoute);
app.use('/api/network', networkRoute);
app.use('/api/stats', statsRoute);
app.use('/api/prediction', predictionRoute);
app.use('/api/disaster', disasterRoute);
app.use('/api/qr', qrRoute);
app.use('/api/resources', resourcesRoute);
app.use('/api/persons', personsRoute);

// ── PAGES Education Routes ──────────────────────────────────
app.use('/api/child', childRoute);
app.use('/api/session', sessionRoute);
app.use('/api', dashboardRoute);

// ── Error Handling ──────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  logger.info('════════════════════════════════════════════');
  logger.info('  SmartCamp Unified Backend');
  logger.info(`  Device:  ${C.DEVICE_ID}`);
  logger.info(`  Camp:    ${C.CAMP_ID}`);
  logger.info(`  Port:    ${PORT}`);
  logger.info(`  Env:     ${C.NODE_ENV}`);
  logger.info('════════════════════════════════════════════');
});
