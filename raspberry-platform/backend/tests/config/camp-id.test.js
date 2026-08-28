import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/constants.js', () => ({
  default: { DEVICE_ID: 'SCB-TEST-01' },
}));

let campId;

beforeEach(async () => {
  vi.resetModules();
  vi.doMock('../../config/constants.js', () => ({
    default: { DEVICE_ID: 'SCB-TEST-01' },
  }));
  campId = await import('../../config/camp-id.js');
});

describe('camp-id module', () => {
  describe('getCampId', () => {
    it('returns DEVICE_ID', () => {
      expect(campId.getCampId()).toBe('SCB-TEST-01');
    });

    it('always returns the same value (no mutation)', () => {
      expect(campId.getCampId()).toBe('SCB-TEST-01');
      expect(campId.getCampId()).toBe('SCB-TEST-01');
    });
  });
});
