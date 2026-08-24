import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the backend package root (backend/.env)
loadEnv({ path: path.join(__dirname, '../../.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  port: toInt(process.env.PORT, 3001),

  // PostgreSQL — education/pages persistence (AWS VM)
  db: {
    enabled: process.env.DB_ENABLED === 'true',
    host: process.env.DB_HOST || 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    name: process.env.DB_NAME || 'smartcamp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    connectionString: process.env.DATABASE_URL || undefined,
  },

  // Network monitoring
  enableSimulation: process.env.ENABLE_SIMULATION === 'true',
  useRealNetwork: process.env.USE_REAL_NETWORK === 'true',
  pingTarget: process.env.PING_TARGET || '8.8.8.8',

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },

  // EMQX broker — same broker the Pi publishes to
  emqx: {
    host: process.env.EMQX_HOST || 'i17140d1.ala.asia-southeast1.emqxsl.com',
    port: toInt(process.env.EMQX_PORT, 8883),
    username: process.env.EMQX_USERNAME || 'admin',
    password: process.env.EMQX_PASSWORD || 'public',
    caCertPath:
      process.env.EMQX_CA_CERT || path.join(__dirname, '../../emqxsl-ca.crt'),
  },

  // Disaster prediction (edge-gateway integration)
  disaster: {
    pythonExecutable: process.env.DISASTER_PYTHON_EXECUTABLE || undefined,
    floodModelScript: process.env.DISASTER_FLOOD_MODEL_SCRIPT || undefined,
    edgeGatewayBaseUrl:
      process.env.DISASTER_EDGE_GATEWAY_BASE_URL || 'http://localhost:5000',
    edgeWaterLevelHistoryPath:
      process.env.DISASTER_EDGE_WATER_LEVEL_HISTORY_PATH ||
      '/gauging-station-water-level-history',
  },

  // Resources domain — Sri Lanka ration rate table.
  // Built by cloud-platform/prediction-models/scripts/build_lka_rate_table.py
  resources: {
    rationRatesPath:
      process.env.RATION_RATES_PATH ||
      path.join(__dirname, '../../../prediction-models/models/lka_v2/ration_rates.json'),
  },

  // Alert database (Education domain)
  alerts: {
    dbPath: process.env.ALERTS_DB_PATH || path.join(__dirname, '../../data/alerts.db'),
  },
};
