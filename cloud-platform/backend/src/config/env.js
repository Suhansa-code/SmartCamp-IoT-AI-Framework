import { config as loadEnv } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from the backend package root (backend/.env)
loadEnv({ path: path.join(__dirname, '../../.env') });

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3001),

  donations: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    // An omitted secret gets a safe process-local value. Production should set
    // a stable secret so donor sessions survive a restart.
    sessionSecret: process.env.DONATION_SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publicUrl: (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  },

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
    // Per-address TCP handshake budget (see database.js). Node's 250ms default
    // is too tight for a managed database several hundred ms away.
    connectAttemptTimeoutMs: toInt(process.env.DB_CONNECT_ATTEMPT_TIMEOUT_MS, 5000),
    // Time allowed for connect + TLS + SCRAM before the pool gives up. A high
    // RTT link spends several round trips in the handshake alone.
    connectionTimeoutMs: toInt(process.env.DB_CONNECTION_TIMEOUT_MS, 15000),
  },

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },

  // EMQX broker — same broker the Pi publishes to
  emqx: {
    host: process.env.EMQX_HOST || 'sa60a43c.ala.asia-southeast1.emqxsl.com',
    port: toInt(process.env.EMQX_PORT, 8883),
    username: process.env.EMQX_USERNAME || 'admin',
    password: process.env.EMQX_PASSWORD || 'admin@123',
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
    defaultCampId: process.env.DEFAULT_CAMP_ID || 'SCB-UNIT-01',
    rationRatesPath:
      process.env.RATION_RATES_PATH ||
      path.join(__dirname, '../../../prediction-models/models/lka_v2/ration_rates.json'),
    foodRatesRawPath:
      process.env.FOOD_RATES_RAW_PATH ||
      path.join(__dirname, '../../../prediction-models/models/lka_v2/food_rates_raw.json'),
    commoditySharesPath:
      process.env.COMMODITY_SHARES_PATH ||
      path.join(__dirname, '../../../prediction-models/models/lka_v2/commodity_shares.json'),
    // Alias table read by commodityStandardizer.service.js. Unlike its
    // neighbours this artifact is hand-curated rather than generated, so it is
    // checked in rather than rebuilt; scripts/validate_commodity_aliases.py
    // fails if it drifts out of step with commodity_shares.json.
    commodityAliasesPath:
      process.env.COMMODITY_ALIASES_PATH ||
      path.join(__dirname, '../../../prediction-models/models/lka_v2/commodity_aliases.json'),
    // Days between placing a resupply order and it reaching the camp. Drives
    // the reorder-by date and the forecast-aware stock status thresholds.
    resupplyLeadTimeDays: Number(process.env.RESUPPLY_LEAD_TIME_DAYS || 3),
  },

  // Alert database (Education domain)
  alerts: {
    dbPath: process.env.ALERTS_DB_PATH || path.join(__dirname, '../../data/alerts.db'),
  },

  // Relief portal — provider adapters run in sandbox until real credentials
  // and partner agreements exist. Never fabricate live availability: adapters
  // report availability_source so the UI can label data honestly.
  relief: {
    providerMode: process.env.RELIEF_PROVIDER_MODE || 'sandbox', // 'sandbox' | 'live'
    payhere: {
      merchantId: process.env.PAYHERE_MERCHANT_ID || '',
      merchantSecret: process.env.PAYHERE_SECRET || '',
      mode: process.env.PAYHERE_MODE || 'sandbox', // 'sandbox' | 'live'
      baseUrl: process.env.PAYHERE_BASE_URL || 'https://sandbox.payhere.lk',
      notifyUrl: process.env.PAYHERE_NOTIFY_URL || '',
      returnUrl: process.env.PAYHERE_RETURN_URL || '',
      cancelUrl: process.env.PAYHERE_CANCEL_URL || '',
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    uber: {
      clientId: process.env.UBER_CLIENT_ID || '',
      clientSecret: process.env.UBER_CLIENT_SECRET || '',
      serverToken: process.env.UBER_SERVER_TOKEN || '',
      baseUrl: process.env.UBER_BASE_URL || 'https://api.uber.com/v1',
      sandbox: process.env.UBER_SANDBOX === 'true',
    },
    pickme: {
      apiKey: process.env.PICKME_API_KEY || '',
      merchantId: process.env.PICKME_MERCHANT_ID || '',
      baseUrl: process.env.PICKME_BASE_URL || 'https://admin.pickme.lk/api',
    },
    // Partner supermarket APIs — populated only after a commercial agreement.
    // Empty keys mean the adapter reports live:false and serves the sandbox
    // catalogue with an explicit availability_source label.
    keells: {
      apiKey: process.env.KEELLS_API_KEY || '',
      merchantId: process.env.KEELLS_MERCHANT_ID || '',
      baseUrl: process.env.KEELLS_BASE_URL || '',
    },
    cargills: {
      apiKey: process.env.CARGILLS_API_KEY || '',
      merchantId: process.env.CARGILLS_MERCHANT_ID || '',
      baseUrl: process.env.CARGILLS_BASE_URL || '',
    },
    arpico: {
      apiKey: process.env.ARPICO_API_KEY || '',
      merchantId: process.env.ARPICO_MERCHANT_ID || '',
      baseUrl: process.env.ARPICO_BASE_URL || '',
    },
    spar: {
      apiKey: process.env.SPAR_API_KEY || '',
      merchantId: process.env.SPAR_MERCHANT_ID || '',
      baseUrl: process.env.SPAR_BASE_URL || '',
    },
    // HMAC secret for sandbox payment callback verification (dev/demo only).
    sandboxWebhookSecret: process.env.RELIEF_SANDBOX_WEBHOOK_SECRET || 'relief-sandbox-secret',
    // Guest checkout lets the public portal work before Google OAuth is
    // configured. Guests can create/track an order by its reference but cannot
    // list order history; every payment still requires server-side verification.
    // Force off in live mode regardless of the env value.
    guestCheckout: process.env.RELIEF_GUEST_CHECKOUT !== 'false'
      && (process.env.RELIEF_PROVIDER_MODE || 'sandbox') !== 'live',
  },
};
