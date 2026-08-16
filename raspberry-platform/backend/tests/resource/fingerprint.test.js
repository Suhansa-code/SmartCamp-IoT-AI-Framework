import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockAll = vi.fn();
const mockGet = vi.fn();
const mockRun = vi.fn();
const mockDb = { prepare: vi.fn(() => ({ all: mockAll, get: mockGet, run: mockRun })) };

vi.mock('../../config/database.js', () => ({ campDb: mockDb }));

let fingerprint;
beforeAll(async () => {
  fingerprint = await import('../../services/resource/fingerprint.js');
});

describe('scanFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue({ id: 1, full_name: 'Kasun Perera', pre_registered: 0 });
  });

  it('queries ALL persons (not only pre-registered) for a match', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    fingerprint.scanFingerprint();
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const scanSql = sqlCalls.find(s => s.includes('FROM persons'));
    expect(scanSql).toBeDefined();
    expect(scanSql).not.toContain('pre_registered');
    expect(mockGet).toHaveBeenCalled();
  });

  it('returns matched false when random draw is above threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const result = fingerprint.scanFingerprint();
    expect(result).toEqual({ matched: false });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns matched true with person when a record exists', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    mockGet.mockReturnValue({ id: 3, full_name: 'Nimali Silva' });
    const result = fingerprint.scanFingerprint();
    expect(result.matched).toBe(true);
    expect(result.person.full_name).toBe('Nimali Silva');
  });

  it('returns matched false when no persons in database', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    mockGet.mockReturnValue(undefined);
    const result = fingerprint.scanFingerprint();
    expect(result.matched).toBe(false);
  });
});

describe('searchPersons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAll.mockReturnValue([{ id: 1, full_name: 'Kasun Perera' }]);
  });

  it('returns empty array for empty query', () => {
    const result = fingerprint.searchPersons('');
    expect(result).toEqual([]);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', () => {
    const result = fingerprint.searchPersons('   ');
    expect(result).toEqual([]);
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns empty array for null/undefined query', () => {
    expect(fingerprint.searchPersons(null)).toEqual([]);
    expect(fingerprint.searchPersons(undefined)).toEqual([]);
  });

  it('searches by name, fingerprint id, and wristband barcode', () => {
    fingerprint.searchPersons('Kasun');
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const searchSql = sqlCalls.find(s => s.includes('SELECT p.*'));
    expect(searchSql).toBeDefined();
    expect(searchSql).toContain('full_name LIKE ?');
    expect(searchSql).toContain('fingerprint_id LIKE ?');
    expect(searchSql).toContain('barcode LIKE ?');
    expect(mockAll).toHaveBeenCalledWith('%Kasun%', '%Kasun%', '%Kasun%');
  });

  it('returns results from the database', () => {
    const result = fingerprint.searchPersons('Perera');
    expect(result).toEqual([{ id: 1, full_name: 'Kasun Perera' }]);
  });

  it('limits results to 10', () => {
    fingerprint.searchPersons('test');
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const searchSql = sqlCalls.find(s => s.includes('LIMIT'));
    expect(searchSql).toContain('LIMIT 10');
  });

  it('only searches active persons', () => {
    fingerprint.searchPersons('test');
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const searchSql = sqlCalls.find(s => s.includes('is_active'));
    expect(searchSql).toContain('is_active = 1');
  });
});

describe('linkFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockReturnValue({ id: 5, full_name: 'Ravi Jayasuriya' });
    mockRun.mockReturnValue({ changes: 1 });
  });

  it('throws 404 when person does not exist', () => {
    mockGet.mockReturnValue(undefined);
    expect(() => fingerprint.linkFingerprint(999)).toThrowError('Person not found');
  });

  it('throws 404 with status 404', () => {
    mockGet.mockReturnValue(undefined);
    try {
      fingerprint.linkFingerprint(999);
    } catch (err) {
      expect(err.status).toBe(404);
    }
  });

  it('binds a fresh fingerprint id to the person', () => {
    const result = fingerprint.linkFingerprint(5);
    expect(result.full_name).toBe('Ravi Jayasuriya');
    expect(result.fingerprint_id).toMatch(/^FP_\d+_[a-z0-9]+$/);

    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const updateSql = sqlCalls.find(s => s.includes('UPDATE persons SET fingerprint_id'));
    expect(updateSql).toBeDefined();
    expect(mockRun).toHaveBeenCalledWith(expect.stringMatching(/^FP_/), 5);
  });

  it('preserves other person fields', () => {
    mockGet.mockReturnValue({ id: 5, full_name: 'Ravi', age: 30, gender: 'M' });
    const result = fingerprint.linkFingerprint(5);
    expect(result.age).toBe(30);
    expect(result.gender).toBe('M');
  });
});
