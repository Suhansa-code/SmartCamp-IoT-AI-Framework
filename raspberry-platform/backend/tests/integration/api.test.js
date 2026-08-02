import { describe, it, expect, vi, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mock all external dependencies ─────────────────────────────────────────────

vi.mock('../../config/database.js', () => ({
  campDb: {
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ lastInsertRowid: 99 })),
      get: vi.fn(() => ({ c: 42, id: 99, fingerprint_id: 'FP_42', full_name: 'Mock', age: 30, gender: 'M', person_type: 'refugee', family_unit_id: 'FAM_42', family_size: 1, is_pregnant: 0, has_chronic_illness: 0, medical_notes: '', pre_registered: 0, created_at: '2026-07-30 22:00:00', barcode: 'WB000099', mqtt_client_id: null, mqtt_password: null })),
      all: vi.fn(() => []),
    })),
  },
  pagesDb: {
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn(() => []) })),
  },
  pgPool: { connect: vi.fn(), on: vi.fn() },
  initializeCampDb: vi.fn(),
  pgIsReachable: vi.fn(),
}));

vi.mock('../../services/network/saamp-mqtt.js', () => ({
  publishAsClient: vi.fn(() => Promise.resolve({ published: true, action: 'publish' })),
  publish: vi.fn(() => ({ published: true, action: 'publish' })),
  connect: vi.fn(),
  getNetworkState: vi.fn(() => 'STABLE'),
  setNetworkState: vi.fn(),
  flushBuffer: vi.fn(),
  onMessage: vi.fn(),
}));

vi.mock('../../services/network/emqx-manager.js', () => ({
  createMqttUser: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock('../../services/education/scoring.js', () => ({
  checkFlaskHealth: vi.fn(() => Promise.resolve(true)),
  getScore: vi.fn(),
}));

vi.mock('../../services/network/connectivity.js', () => ({
  startConnectivityWatcher: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// ── Build test app ─────────────────────────────────────────────────────────────

let app;

beforeAll(async () => {
  app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'smartcamp-backend', device: 'SCB-UNIT-01', camp: 'CAMP-B' });
  });

  // Routes
  const { default: healthRoute } = await import('../../routes/resource/register.js');
  app.use('/api/register', healthRoute);

  const { default: statsRoute } = await import('../../routes/resource/stats.js');
  app.use('/api/stats', statsRoute);

  const { default: fingerprintRoute } = await import('../../routes/resource/fingerprint.js');
  app.use('/api/fingerprint', fingerprintRoute);

  // 404 + error handler
  const { notFound, errorHandler } = await import('../../middleware/error-handler.js');
  app.use(notFound);
  app.use(errorHandler);
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with service info', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('smartcamp-backend');
    expect(res.body.device).toBeTruthy();
    expect(res.body.camp).toBeTruthy();
  });
});

describe('POST /api/register', () => {
  it('returns 400 when full_name is missing', async () => {
    const res = await request(app).post('/api/register').send({ age: 25 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('returns 400 when age is missing', async () => {
    const res = await request(app).post('/api/register').send({ full_name: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  it('returns 200 with person data on success', async () => {
    const res = await request(app).post('/api/register').send({ full_name: 'Test Person', age: 25 });
    expect(res.status).toBe(200);
    expect(res.body.person).toBeDefined();
    expect(res.body.person.full_name).toBe('Mock');
    expect(res.body.wristband_barcode).toBeTruthy();
  });
});

describe('GET /api/stats/overview', () => {
  it('returns 200 with stats object', async () => {
    const res = await request(app).get('/api/stats/overview');
    expect(res.status).toBe(200);
    expect(res.body.population).toBeDefined();
    expect(res.body.population.total).toBe(42);
    expect(res.body.vulnerable).toBeDefined();
    expect(res.body.distribution_today).toBeDefined();
    expect(res.body.mqtt).toBeDefined();
  });
});

describe('GET /api/stats/distribution-history', () => {
  it('returns 200 with history array', async () => {
    const res = await request(app).get('/api/stats/distribution-history?days=7');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  it('defaults to 7 days when no query param', async () => {
    const res = await request(app).get('/api/stats/distribution-history');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(7);
  });

  it('caps days at 30', async () => {
    const res = await request(app).get('/api/stats/distribution-history?days=100');
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
  });
});

describe('GET /api/fingerprint/search', () => {
  it('returns 200 with results array when a query is provided', async () => {
    const res = await request(app).get('/api/fingerprint/search?q=Kasun');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('returns 200 with empty results for an empty query', async () => {
    const res = await request(app).get('/api/fingerprint/search?q=');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });
});

describe('POST /api/fingerprint/link', () => {
  it('returns 400 when person_id is missing', async () => {
    const res = await request(app).post('/api/fingerprint/link').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('person_id');
  });

  it('returns 200 with re-enrolled person on success', async () => {
    const res = await request(app).post('/api/fingerprint/link').send({ person_id: 99 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.person).toBeDefined();
    expect(res.body.person.fingerprint_id).toMatch(/^FP_\d+$/);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Route not found');
  });
});
