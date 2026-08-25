import 'dotenv/config';

const parseOrigins = (value) => {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

export default {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DEVICE_ID: process.env.DEVICE_ID || 'SCB-UNIT-01',
  CAMP_ID: process.env.CAMP_ID || 'CAMP-B',
  FLOOD_ALERT_HIGH_THRESHOLD: process.env.FLOOD_ALERT_HIGH_THRESHOLD ? parseFloat(process.env.FLOOD_ALERT_HIGH_THRESHOLD) : null,
  FLOOD_ALERT_CRITICAL_THRESHOLD: process.env.FLOOD_ALERT_CRITICAL_THRESHOLD ? parseFloat(process.env.FLOOD_ALERT_CRITICAL_THRESHOLD) : null,

  GATE_THRESHOLD: parseFloat(process.env.GATE_THRESHOLD) || 55,
  BASELINE_INIT: 60.0,
  BASELINE_ALPHA: 0.20,
  TASK_WEIGHT: 0.50,
  PASSIVE_WEIGHT: 0.30,
  BASELINE_WEIGHT: 0.20,
  ZSCORE_THRESHOLD: -2.0,
  IF_SCORE_THRESHOLD: -0.10,
  ALERT_CONSECUTIVE: parseInt(process.env.ALERT_CONSECUTIVE, 10) || 3,
  ALERT_OF_FIVE: parseInt(process.env.ALERT_OF_FIVE, 10) || 3,

  FLASK_URL: process.env.FLASK_URL || 'http://localhost:5001',
  FLASK_TIMEOUT_MS: 8000,

  JWT_SECRET: process.env.JWT_SECRET || 'CHANGE_THIS_SECRET',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',

  CORS_ORIGINS: [
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.FRONTEND_URL),
    'http://192.168.4.1:3000',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
    'http://192.168.137.1:5173',
    'http://172.28.19.168:5173',
  ].filter((origin, index, origins) => origins.indexOf(origin) === index),
  ALLOW_VERCEL_PREVIEWS: parseBoolean(process.env.ALLOW_VERCEL_PREVIEWS, true),

  GATE: {
    PASS: 'PASS',
    FAIL_FIRST: 'FAIL_FIRST',
    FAIL_CONFIRMED: 'FAIL_CONFIRMED',
    PASS_RECOVERED: 'PASS_RECOVERED',
  },

  ALERT_TYPES: {
    CONSECUTIVE: '3_consecutive_flagged',
    OF_FIVE: '3_of_5_flagged',
  },

  CAMP_DB_PATH: process.env.CAMP_DB_PATH || './db/camp.db',
  PAGES_DB_PATH: process.env.PAGES_DB_PATH || './db/pages.db',
  DISASTER_DB_PATH: process.env.DISASTER_DB_PATH || './db/disaster.db',
  MODELS_DIR: './models',

  GPS_STORAGE_INTERVAL_MINUTES: parseInt(process.env.GPS_STORAGE_INTERVAL_MINUTES, 10) || 30,
  GPS_MOVEMENT_THRESHOLD_METERS: parseFloat(process.env.GPS_MOVEMENT_THRESHOLD_METERS) || 100,
  // ── Fingerprint scanner (ESP32 + R503 over USB serial) ──
  FINGERPRINT_ENABLED: parseBoolean(process.env.FINGERPRINT_ENABLED, false),
  FINGERPRINT_SERIAL_PORT: process.env.FINGERPRINT_SERIAL_PORT || '',
  FINGERPRINT_BAUD_RATE: parseInt(process.env.FINGERPRINT_BAUD_RATE, 10) || 115200,
  FINGERPRINT_MAX_SLOTS: parseInt(process.env.FINGERPRINT_MAX_SLOTS, 10) || 200,
  FINGERPRINT_SIMULATE: parseBoolean(process.env.FINGERPRINT_SIMULATE, true),

  WEATHER_FETCH_INTERVAL_MINUTES: parseInt(process.env.WEATHER_FETCH_INTERVAL_MINUTES, 10) || 30,
  WEATHER_LOCATION_THRESHOLD_METERS: parseFloat(process.env.WEATHER_LOCATION_THRESHOLD_METERS) || 500,

  RAINFALL_STORAGE_INTERVAL_MINUTES: parseInt(process.env.RAINFALL_STORAGE_INTERVAL_MINUTES, 10) || 15,

  DHT11_STORAGE_INTERVAL_MINUTES: parseInt(process.env.DHT11_STORAGE_INTERVAL_MINUTES, 10) || 5,

  HYDROSPATIAL_STORAGE_INTERVAL_MINUTES: parseInt(process.env.HYDROSPATIAL_STORAGE_INTERVAL_MINUTES, 10) || 30,

  // ── Flood simulation overrides (for demo) ──────────────────────────────
  FLOOD_SIMULATION_ENABLED: process.env.FLOOD_SIMULATION_ENABLED === 'true',
  FLOOD_SIMULATION_RAINFALL: process.env.FLOOD_SIMULATION_RAINFALL,
  FLOOD_SIMULATION_LATITUDE: process.env.FLOOD_SIMULATION_LATITUDE,
  FLOOD_SIMULATION_LONGITUDE: process.env.FLOOD_SIMULATION_LONGITUDE,
  FLOOD_SIMULATION_ELEVATION: process.env.FLOOD_SIMULATION_ELEVATION,
  FLOOD_SIMULATION_RIVER_DISTANCE_KM: process.env.FLOOD_SIMULATION_RIVER_DISTANCE_KM,
  FLOOD_SIMULATION_WATER_LEVEL: process.env.FLOOD_SIMULATION_WATER_LEVEL,

  EMQX_HOST: process.env.EMQX_HOST || 'i17140d1.ala.asia-southeast1.emqxsl.com',
  EMQX_PORT: process.env.EMQX_PORT || 8883,
  EMQX_USERNAME: process.env.EMQX_USERNAME || 'admin',
  EMQX_PASSWORD: process.env.EMQX_PASSWORD || 'public',
  EMQX_API_KEY: process.env.EMQX_API_KEY || '',
  EMQX_API_SECRET: process.env.EMQX_API_SECRET || '',
  CA_CERT_PATH: process.env.EMQX_CA_CERT || './db/emqxsl-ca.crt',
  PREDICTION_API_URL: process.env.PREDICTION_API_URL,

  AWS_RDS_HOST: process.env.AWS_RDS_HOST || '',
  AWS_RDS_PORT: parseInt(process.env.AWS_RDS_PORT, 10) || 5432,
  AWS_RDS_DB: process.env.AWS_RDS_DB || '',
  AWS_RDS_USER: process.env.AWS_RDS_USER || '',
  AWS_RDS_PASSWORD: process.env.AWS_RDS_PASSWORD || '',
};
