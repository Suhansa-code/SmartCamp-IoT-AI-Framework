import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────

const mockRun = vi.fn();
const mockGet = vi.fn(() => null);
const mockAll = vi.fn(() => []);

vi.mock('../../config/database.js', () => ({
  disasterDb: {
    prepare: vi.fn(() => ({ run: mockRun, get: mockGet, all: mockAll })),
  },
}));

vi.mock('../../config/constants.js', () => ({
  default: {
    DEVICE_ID: 'TEST-UNIT',
    GPS_STORAGE_INTERVAL_MINUTES: 30,
    GPS_MOVEMENT_THRESHOLD_METERS: 100,
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

let mockGpsResult = { latitude: 6.9271, longitude: 79.8612, altitude: 10, accuracy: 5, source: 'GPS_SENSOR', live: true };

vi.mock('../../services/disaster/gps.js', () => ({
  getGpsLocation: vi.fn(async () => mockGpsResult),
  getLastKnownLocation: vi.fn(() => mockGpsResult),
}));

let gpsStorage;

beforeEach(async () => {
  vi.clearAllMocks();
  mockRun.mockReset();
  mockGet.mockReset();
  mockAll.mockReset();
  mockGet.mockReturnValue(null);

  // Re-import to reset module state (especially lastStoredLat/Lng)
  vi.resetModules();
  gpsStorage = await import('../../services/disaster/gps-storage.js');
});

afterEach(() => {
  gpsStorage.stopGpsStorage();
});

// ── Haversine distance ──────────────────────────────────────────────────

describe('haversineDistance', () => {
  it('returns ~0 for same point', () => {
    const d = gpsStorage.haversineDistance(6.9271, 79.8612, 6.9271, 79.8612);
    expect(d).toBe(0);
  });

  it('returns ~111 km for 1-degree latitude difference', () => {
    const d = gpsStorage.haversineDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('returns ~111 km for 1-degree longitude difference at equator', () => {
    const d = gpsStorage.haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('detects ~100m movement', () => {
    // ~0.0009 degrees latitude ≈ 100m
    const d = gpsStorage.haversineDistance(6.9271, 79.8612, 6.9280, 79.8612);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(120);
  });
});

// ── storeCurrentLocation ────────────────────────────────────────────────

describe('storeCurrentLocation', () => {
  it('inserts a valid GPS reading with synced = 0', async () => {
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(1);
    const args = mockRun.mock.calls[0];
    expect(args[0]).toBe('TEST-UNIT');
    expect(args[1]).toBeCloseTo(6.9271, 4);
    expect(args[2]).toBeCloseTo(79.8612, 4);
    expect(args[3]).toBe(10);
    expect(args[4]).toBe(5);
    expect(args[5]).toBe('GPS_SENSOR');
    expect(typeof args[6]).toBe('string'); // recorded_at ISO string
    // synced = 0 is in the SQL, not passed as param
  });

  it('returns false and does not insert when GPS is unavailable', async () => {
    mockGpsResult = { latitude: null, longitude: null, altitude: null, error: 'No fix', live: false };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('returns false for invalid latitude', async () => {
    mockGpsResult = { latitude: 999, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('returns false for NaN coordinates', async () => {
    mockGpsResult = { latitude: NaN, longitude: NaN, altitude: 10, accuracy: 5, live: true };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('stores altitude and accuracy as null when missing', async () => {
    mockGpsResult = { latitude: 6.9271, longitude: 79.8612, live: true };
    await gpsStorage.storeCurrentLocation();
    const args = mockRun.mock.calls[0];
    expect(args[3]).toBeNull(); // altitude
    expect(args[4]).toBeNull(); // accuracy
    expect(args[5]).toBe('GPS_SENSOR'); // default source
  });

  it('records the actual time in recorded_at', async () => {
    const before = Date.now();
    await gpsStorage.storeCurrentLocation();
    const recordedAt = new Date(mockRun.mock.calls[0][6]).getTime();
    const after = Date.now();
    // Allow 5-second tolerance for timezone offset (Colombo GMT+5:30)
    expect(recordedAt).toBeGreaterThanOrEqual(before - 5000);
    expect(recordedAt).toBeLessThanOrEqual(after + 5000);
  });

  it('stores MOCK_LOCATION source when GPS is mock', async () => {
    mockGpsResult = { latitude: 6.9271, longitude: 79.8612, altitude: 0, accuracy: null, source: 'MOCK_LOCATION', live: false };
    await gpsStorage.storeCurrentLocation();
    const args = mockRun.mock.calls[0];
    expect(args[5]).toBe('MOCK_LOCATION');
  });
});

// ── Movement-based storage ──────────────────────────────────────────────

describe('movement detection', () => {
  it('skips second insert when movement < 100m', async () => {
    // First insert succeeds
    mockGpsResult = { latitude: 6.9271, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    await gpsStorage.storeCurrentLocation();
    expect(mockRun).toHaveBeenCalledTimes(1);

    // Second read: ~50m away → should skip
    mockGpsResult = { latitude: 6.9275, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(false);
    expect(mockRun).toHaveBeenCalledTimes(1); // still only 1 call
  });

  it('inserts second record when movement >= 100m', async () => {
    // First insert
    mockGpsResult = { latitude: 6.9271, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    await gpsStorage.storeCurrentLocation();
    expect(mockRun).toHaveBeenCalledTimes(1);

    // Second read: ~200m away → should insert
    mockGpsResult = { latitude: 6.9290, longitude: 79.8612, altitude: 12, accuracy: 3, live: true };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(true);
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('resets movement tracking after each valid insert', async () => {
    // First at origin
    mockGpsResult = { latitude: 6.9271, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    await gpsStorage.storeCurrentLocation();

    // Move ~150m → insert
    mockGpsResult = { latitude: 6.9285, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    await gpsStorage.storeCurrentLocation();
    expect(mockRun).toHaveBeenCalledTimes(2);

    // Now 6.9285 is the new reference — move only 20m from it → skip
    mockGpsResult = { latitude: 6.9287, longitude: 79.8612, altitude: 10, accuracy: 5, live: true };
    const result = await gpsStorage.storeCurrentLocation();
    expect(result).toBe(false);
    expect(mockRun).toHaveBeenCalledTimes(2); // no new insert
  });
});

// ── Start/stop lifecycle ────────────────────────────────────────────────

describe('startGpsStorage / stopGpsStorage', () => {
  it('exports startGpsStorage and stopGpsStorage as functions', () => {
    expect(typeof gpsStorage.startGpsStorage).toBe('function');
    expect(typeof gpsStorage.stopGpsStorage).toBe('function');
  });

  it('getGpsStorageStatus returns structured object', () => {
    const status = gpsStorage.getGpsStorageStatus();
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('interval_ms');
    expect(status).toHaveProperty('movement_threshold_m');
    expect(status).toHaveProperty('last_stored');
    expect(status.interval_ms).toBe(30 * 60_000);
    expect(status.movement_threshold_m).toBe(100);
  });
});
