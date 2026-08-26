import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config/database.js', () => ({
  pagesDb: { prepare: vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })) })) },
  disasterDb: { prepare: vi.fn(() => ({ run: vi.fn(() => ({ changes: 0 })) })) },
}));

vi.mock('fs', async () => {
  const store = {};
  return {
    default: {
      readFileSync: vi.fn((path) => {
        if (store[path]) return store[path];
        throw new Error('ENOENT');
      }),
      writeFileSync: vi.fn((path, data) => { store[path] = data; }),
      mkdirSync: vi.fn(),
      existsSync: vi.fn((path) => !!store[path]),
    },
    readFileSync: vi.fn((path) => {
      if (store[path]) return store[path];
      throw new Error('ENOENT');
    }),
    writeFileSync: vi.fn((path, data) => { store[path] = data; }),
    mkdirSync: vi.fn(),
    existsSync: vi.fn((path) => !!store[path]),
  };
});

let campId;

beforeEach(async () => {
  vi.resetModules();

  vi.doMock('../../config/constants.js', () => ({
    default: { DEVICE_ID: 'SCB-TEST-01' },
  }));

  vi.doMock('fs', async () => {
    const store = {};
    return {
      default: {
        readFileSync: vi.fn((path) => {
          if (store[path]) return store[path];
          throw new Error('ENOENT');
        }),
        writeFileSync: vi.fn((path, data) => { store[path] = data; }),
        mkdirSync: vi.fn(),
        existsSync: vi.fn((path) => !!store[path]),
      },
      readFileSync: vi.fn((path) => {
        if (store[path]) return store[path];
        throw new Error('ENOENT');
      }),
      writeFileSync: vi.fn((path, data) => { store[path] = data; }),
      mkdirSync: vi.fn(),
      existsSync: vi.fn((path) => !!store[path]),
    };
  });

  campId = await import('../../config/camp-id.js');
});

describe('camp-id module', () => {
  describe('deriveCampId', () => {
    it('derives CAMP-H from "Homagama"', () => {
      expect(campId.deriveCampId('Homagama')).toBe('CAMP-H');
    });

    it('derives CAMP-B from "Baddegama"', () => {
      expect(campId.deriveCampId('Baddegama')).toBe('CAMP-B');
    });

    it('derives CAMP-C from "Colombo"', () => {
      expect(campId.deriveCampId('Colombo')).toBe('CAMP-C');
    });

    it('uppercases first letter', () => {
      expect(campId.deriveCampId('homagama')).toBe('CAMP-H');
    });

    it('returns null for null/undefined', () => {
      expect(campId.deriveCampId(null)).toBeNull();
      expect(campId.deriveCampId(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(campId.deriveCampId('')).toBeNull();
    });

    it('returns null for non-string input', () => {
      expect(campId.deriveCampId(123)).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(campId.deriveCampId('   ')).toBeNull();
    });

    it('handles leading whitespace', () => {
      expect(campId.deriveCampId('  Homagama')).toBe('CAMP-H');
    });
  });

  describe('getCampId', () => {
    it('returns DEVICE_ID as initial value', () => {
      expect(campId.getCampId()).toBe('SCB-TEST-01');
    });
  });

  describe('isGpsDerived', () => {
    it('returns false initially', () => {
      expect(campId.isGpsDerived()).toBe(false);
    });
  });

  describe('updateCampIdFromGps', () => {
    it('updates CAMP_ID from GPS location', () => {
      const result = campId.updateCampIdFromGps('Homagama');
      expect(result).toBe('CAMP-H');
      expect(campId.getCampId()).toBe('CAMP-H');
      expect(campId.isGpsDerived()).toBe(true);
    });

    it('returns null for invalid location', () => {
      const result = campId.updateCampIdFromGps(null);
      expect(result).toBeNull();
      expect(campId.getCampId()).toBe('SCB-TEST-01');
    });

    it('does not update if same location derived', () => {
      campId.updateCampIdFromGps('Homagama');
      const result = campId.updateCampIdFromGps('Homagama');
      expect(result).toBe('CAMP-H');
      expect(campId.getCampId()).toBe('CAMP-H');
    });
  });

  describe('setCampId', () => {
    it('force-sets CAMP_ID', () => {
      campId.setCampId('CAMP-X');
      expect(campId.getCampId()).toBe('CAMP-X');
      expect(campId.isGpsDerived()).toBe(true);
    });
  });
});
