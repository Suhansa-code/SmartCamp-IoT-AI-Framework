import { describe, it, expect } from 'vitest';
import { enqueueSync, enqueueSyncBatch, TABLE_PK } from '../../services/sync/sync-notify.js';

describe('sync-notify', () => {
  describe('enqueueSync', () => {
    it('never throws for valid table', () => {
      expect(() => enqueueSync('persons', 42)).not.toThrow();
    });

    it('never throws for unknown table', () => {
      expect(() => enqueueSync('nonexistent', 999)).not.toThrow();
    });

    it('never throws for null recordId', () => {
      expect(() => enqueueSync('persons', null)).not.toThrow();
    });

    it('never throws for string recordId', () => {
      expect(() => enqueueSync('pages_sessions', 'SESS-001')).not.toThrow();
    });

    it('never throws with meta', () => {
      expect(() => enqueueSync('persons', 1, { priority: 'CRITICAL' })).not.toThrow();
    });
  });

  describe('enqueueSyncBatch', () => {
    it('never throws for valid table', () => {
      expect(() => enqueueSyncBatch('persons', [1, 2, 3])).not.toThrow();
    });

    it('never throws for empty array', () => {
      expect(() => enqueueSyncBatch('persons', [])).not.toThrow();
    });

    it('never throws for unknown table', () => {
      expect(() => enqueueSyncBatch('nonexistent', [1, 2])).not.toThrow();
    });
  });

  describe('TABLE_PK', () => {
    it('maps all 23 syncable tables', () => {
      const expected = [
        'persons', 'camp_checkins', 'wristbands', 'distributions',
        'resources', 'resource_usage', 'audit_logs',
        'pages_children', 'pages_sessions', 'pages_behavioral_signals',
        'pages_gate_decisions', 'pages_alerts', 'pages_content_responses',
        'disaster_events',
        'water_level_readings', 'gps_readings', 'weather_data',
        'hydrospatial_data', 'flood_predictions', 'disaster_alerts',
        'prediction_requests',
      ];
      expect(Object.keys(TABLE_PK).length).toBe(23);
      for (const table of expected) {
        expect(TABLE_PK[table]).toBeDefined();
      }
    });

    it('education tables use non-id primary keys', () => {
      expect(TABLE_PK.pages_children).toBe('child_id');
      expect(TABLE_PK.pages_sessions).toBe('session_id');
      expect(TABLE_PK.pages_behavioral_signals).toBe('signal_id');
      expect(TABLE_PK.pages_gate_decisions).toBe('decision_id');
      expect(TABLE_PK.pages_alerts).toBe('alert_id');
      expect(TABLE_PK.pages_content_responses).toBe('response_id');
    });
  });
});
