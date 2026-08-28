import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);

vi.mock('../../config/database.js', () => ({
  disasterDb: {
    prepare: vi.fn(() => ({ run: mockRun, get: mockGet, all: mockAll })),
  },
  campDb: {
    prepare: vi.fn(() => ({ run: vi.fn() })),
  },
}));

vi.mock('../../config/camp-id.js', () => ({
  getCampId: vi.fn(() => 'CAMP-TEST'),
}));

vi.mock('../network/saamp-mqtt.js', () => ({
  publish: vi.fn(() => ({ published: true })),
}));

vi.mock('./disaster.js', () => ({
  getCampById: vi.fn(() => ({ name: 'Test Camp' })),
}));

let alertEvaluator;

beforeEach(async () => {
  vi.clearAllMocks();
  mockAll.mockReturnValue([]);
  mockGet.mockReturnValue(null);
  alertEvaluator = await import('../../services/disaster/alert-evaluator.js');
});

describe('alert-evaluator', () => {
  describe('normalizeRisk', () => {
    it('normalizes SEVERE to CRITICAL', () => {
      expect(alertEvaluator.normalizeRisk('SEVERE')).toBe('CRITICAL');
    });

    it('normalizes EXTREME to CRITICAL', () => {
      expect(alertEvaluator.normalizeRisk('EXTREME')).toBe('CRITICAL');
    });

    it('passes through HIGH', () => {
      expect(alertEvaluator.normalizeRisk('HIGH')).toBe('HIGH');
    });

    it('passes through CRITICAL', () => {
      expect(alertEvaluator.normalizeRisk('CRITICAL')).toBe('CRITICAL');
    });

    it('passes through LOW', () => {
      expect(alertEvaluator.normalizeRisk('LOW')).toBe('LOW');
    });

    it('returns empty for undefined/null', () => {
      expect(alertEvaluator.normalizeRisk(undefined)).toBe('');
      expect(alertEvaluator.normalizeRisk(null)).toBe('');
    });
  });

  describe('evaluateFloodPrediction', () => {
    it('returns not alertable for LOW risk', () => {
      const result = alertEvaluator.evaluateFloodPrediction({
        prediction: { risk_category: 'LOW', flood_probability: 0.2 },
        inputs: { latitude: 6.9, longitude: 79.8 },
      });
      expect(result.created).toBe(false);
      expect(result.reason).toBe('risk_not_alertable');
    });

    it('creates alert for HIGH risk', () => {
      mockAll.mockReturnValue([]);
      mockGet.mockReturnValue({
        id: 1, event_id: 'evt-1', alert_id: 'al-1', camp_id: 'CAMP-TEST',
        severity: 'HIGH', title: 'HIGH FLOOD RISK', status: 'ACTIVE',
        created_at: '2026-08-26T14:00:00Z', source: 'raspberry_pi',
      });

      const result = alertEvaluator.evaluateFloodPrediction({
        prediction: { risk_category: 'HIGH', flood_probability: 0.7, forecast_hours: 24 },
        inputs: { latitude: 6.9, longitude: 79.8, rainfall_mm: 50 },
        hydrospatial: { station_id: 'ST-001' },
        predictionId: 'pred-001',
      });
      expect(result.created).toBe(true);
    });

    it('refreshes existing equivalent alert instead of creating duplicate', () => {
      mockAll.mockReturnValue([{
        id: 1, severity: 'HIGH', event_id: 'existing-evt',
      }]);

      const result = alertEvaluator.evaluateFloodPrediction({
        prediction: { risk_category: 'HIGH', flood_probability: 0.7 },
        inputs: { latitude: 6.9, longitude: 79.8 },
        predictionId: 'pred-002',
      });
      expect(result.created).toBe(false);
      expect(result.refreshed).toBe(true);
    });

    it('creates CRITICAL alert for CRITICAL risk', () => {
      mockAll.mockReturnValue([]);
      mockGet.mockReturnValue({
        id: 2, event_id: 'evt-2', alert_id: 'al-2', camp_id: 'CAMP-TEST',
        severity: 'CRITICAL', title: 'CRITICAL FLOOD RISK', status: 'ACTIVE',
        created_at: '2026-08-26T14:00:00Z', source: 'raspberry_pi',
      });

      const result = alertEvaluator.evaluateFloodPrediction({
        prediction: { risk_category: 'CRITICAL', flood_probability: 0.95 },
        inputs: { latitude: 6.9, longitude: 79.8, water_level_m: 5.2, river_distance_km: 0.5 },
        hydrospatial: { station_name: 'Hanwella' },
        predictionId: 'pred-003',
      });
      expect(result.created).toBe(true);
    });
  });
});
