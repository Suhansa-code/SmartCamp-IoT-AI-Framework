import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockGet = vi.fn();
const mockAll = vi.fn();
const mockDb = { prepare: vi.fn(() => ({ get: mockGet, all: mockAll })) };

vi.mock('../../config/database.js', () => ({ campDb: mockDb }));

let wristband;
beforeAll(async () => {
  wristband = await import('../../services/resource/wristband.js');
});

describe('getWristbandInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns person and today distributions for valid barcode', () => {
    mockGet
      .mockReturnValueOnce({ barcode: 'WB001', person_id: 10 })
      .mockReturnValueOnce({ id: 10, full_name: 'Kasun' });
    mockAll.mockReturnValue([{ resource_type: 'breakfast' }, { resource_type: 'water' }]);

    const result = wristband.getWristbandInfo('WB001');
    expect(result.person.full_name).toBe('Kasun');
    expect(result.wristband_barcode).toBe('WB001');
    expect(result.today_distributions.breakfast).toBe(true);
    expect(result.today_distributions.lunch).toBe(false);
    expect(result.today_distributions.water).toBe(true);
    expect(result.today_distributions.dinner).toBe(false);
  });

  it('throws 404 for unknown barcode', () => {
    mockGet.mockReturnValue(undefined);
    expect(() => wristband.getWristbandInfo('UNKNOWN')).toThrow('Wristband not found');
  });

  it('throws 404 with status when wristband not found', () => {
    mockGet.mockReturnValue(undefined);
    try {
      wristband.getWristbandInfo('UNKNOWN');
    } catch (err) {
      expect(err.status).toBe(404);
    }
  });

  it('throws 404 when person not found', () => {
    mockGet
      .mockReturnValueOnce({ barcode: 'WB001', person_id: 999 })
      .mockReturnValueOnce(undefined);
    expect(() => wristband.getWristbandInfo('WB001')).toThrow('Person not found');
  });

  it('returns all false when no distributions today', () => {
    mockGet
      .mockReturnValueOnce({ barcode: 'WB001', person_id: 10 })
      .mockReturnValueOnce({ id: 10, full_name: 'Test' });
    mockAll.mockReturnValue([]);

    const result = wristband.getWristbandInfo('WB001');
    expect(result.today_distributions.breakfast).toBe(false);
    expect(result.today_distributions.lunch).toBe(false);
    expect(result.today_distributions.dinner).toBe(false);
    expect(result.today_distributions.water).toBe(false);
  });
});

describe('getDistributionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns distribution history for valid barcode', () => {
    mockGet.mockReturnValue({ barcode: 'WB001', person_id: 10 });
    mockAll.mockReturnValue([
      { id: 1, resource_type: 'breakfast', quantity: 0.5, distributed_at: '2026-08-02 08:00:00' },
      { id: 2, resource_type: 'lunch', quantity: 1.0, distributed_at: '2026-08-01 12:00:00' },
    ]);

    const result = wristband.getDistributionHistory('WB001');
    expect(result.barcode).toBe('WB001');
    expect(result.distributions).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('throws 404 for unknown barcode', () => {
    mockGet.mockReturnValue(undefined);
    expect(() => wristband.getDistributionHistory('UNKNOWN')).toThrow('Wristband not found');
  });

  it('filters by days when provided', () => {
    mockGet.mockReturnValue({ barcode: 'WB001', person_id: 10 });
    mockAll.mockReturnValue([]);

    wristband.getDistributionHistory('WB001', { days: 7 });
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const sql = sqlCalls.find(s => s.includes('distributed_at'));
    expect(sql).toContain("DATE('now'");
  });

  it('returns empty when no distributions', () => {
    mockGet.mockReturnValue({ barcode: 'WB001', person_id: 10 });
    mockAll.mockReturnValue([]);

    const result = wristband.getDistributionHistory('WB001');
    expect(result.distributions).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('orders by distributed_at DESC', () => {
    mockGet.mockReturnValue({ barcode: 'WB001', person_id: 10 });
    mockAll.mockReturnValue([]);

    wristband.getDistributionHistory('WB001');
    const sqlCalls = mockDb.prepare.mock.calls.map(c => c[0]);
    const sql = sqlCalls.find(s => s.includes('ORDER BY'));
    expect(sql).toContain('ORDER BY distributed_at DESC');
  });
});
