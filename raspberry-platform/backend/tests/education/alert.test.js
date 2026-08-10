import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockGet = vi.fn();
const mockRun = vi.fn();
const mockAll = vi.fn();
const mockTransaction = vi.fn((fn) => fn);
const mockPagesDb = {
  prepare: vi.fn(() => ({ get: mockGet, run: mockRun, all: mockAll })),
  transaction: mockTransaction,
};

vi.mock('../../config/database.js', () => ({ pagesDb: mockPagesDb }));
vi.mock('../../utils/logger.js', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const mockEnqueue = vi.fn();
vi.mock('../../utils/helpers.js', () => ({
  newId: vi.fn(() => 'alert-uuid-123'),
  nowISO: vi.fn(() => '2026-08-02T15:00:00+05:30'),
  enqueue: mockEnqueue,
}));

let alert;
beforeAll(async () => {
  alert = await import('../../services/education/alert.js');
});

describe('checkAndCreateAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({});
    mockAll.mockReturnValue([]);
  });

  it('does nothing when child not found', () => {
    mockGet.mockReturnValue(undefined);
    alert.checkAndCreateAlert('NONEXISTENT', 'sess-1');
    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(false);
  });

  it('creates 3_consecutive_flagged alert when consecutive_low >= 3', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 3 });

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(true);
  });

  it('resets consecutive_low after creating consecutive alert', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 3 });

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('consecutive_low = 0'))).toBe(true);
  });

  it('calls enqueue after creating alert', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 3 });

    alert.checkAndCreateAlert('B-001', 'sess-1');
    expect(mockEnqueue).toHaveBeenCalled();
  });

  it('does not create alert when consecutive_low < 3 and few sessions', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 2 });
    mockAll.mockReturnValue([{ anomaly_flagged: 1 }]);

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(false);
  });

  it('creates 3_of_5_flagged alert when 3+ of last 5 are flagged', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 0 });
    mockAll.mockReturnValue([
      { anomaly_flagged: 1 }, { anomaly_flagged: 1 }, { anomaly_flagged: 1 },
      { anomaly_flagged: 0 }, { anomaly_flagged: 0 },
    ]);

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(true);
  });

  it('does not create 3_of_5 alert when fewer than 3 flagged', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 0 });
    mockAll.mockReturnValue([
      { anomaly_flagged: 1 }, { anomaly_flagged: 1 },
      { anomaly_flagged: 0 }, { anomaly_flagged: 0 }, { anomaly_flagged: 0 },
    ]);

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(false);
  });

  it('does not check 3_of_5 when fewer than 5 sessions', () => {
    mockGet.mockReturnValue({ child_id: 'B-001', camp_id: 'CAMP', res_id: 'R1', consecutive_low: 0 });
    mockAll.mockReturnValue([{ anomaly_flagged: 1 }]);

    alert.checkAndCreateAlert('B-001', 'sess-1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('INSERT INTO pages_alerts'))).toBe(false);
  });
});

describe('getAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all alerts with recent_scores (reversed order)', () => {
    const alerts = [
      { alert_id: 'a1', child_id: 'B-001', alert_type: '3_consecutive_flagged', status: 'pending' },
    ];
    const sessions = [{ composite_score: 42 }, { composite_score: 65 }];

    mockAll
      .mockReturnValueOnce(alerts)
      .mockReturnValueOnce(sessions);

    const result = alert.getAlerts();
    expect(result).toHaveLength(1);
    expect(result[0].recent_scores).toEqual([65, 42]);
  });

  it('filters by status when provided', () => {
    mockAll.mockReturnValueOnce([]);
    alert.getAlerts('pending');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes('WHERE a.status = ?'))).toBe(true);
  });

  it('returns empty array when no alerts', () => {
    mockAll.mockReturnValueOnce([]);
    const result = alert.getAlerts();
    expect(result).toEqual([]);
  });

  it('filters null composite_scores from recent_scores', () => {
    mockAll
      .mockReturnValueOnce([{ alert_id: 'a1', child_id: 'B-001', status: 'pending' }])
      .mockReturnValueOnce([{ composite_score: null }, { composite_score: 65 }]);

    const result = alert.getAlerts();
    expect(result[0].recent_scores).toEqual([65]);
  });
});

describe('resolveAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({});
  });

  it('returns false when alert not found', () => {
    mockGet.mockReturnValue(undefined);
    const result = alert.resolveAlert('nonexistent');
    expect(result).toBe(false);
  });

  it('resolves an alert and returns true', () => {
    mockGet
      .mockReturnValueOnce({ alert_id: 'a1', child_id: 'B-001' })
      .mockReturnValueOnce({ cnt: 1 });
    mockRun.mockReturnValue({});

    const result = alert.resolveAlert('a1', 'Resolved');
    expect(result).toBe(true);
  });

  it('updates status to resolved', () => {
    mockGet
      .mockReturnValueOnce({ alert_id: 'a1', child_id: 'B-001' })
      .mockReturnValueOnce({ cnt: 1 });

    alert.resolveAlert('a1', 'notes');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes("SET status = 'resolved'"))).toBe(true);
  });

  it('sets alert_status to none when no pending alerts remain', () => {
    mockGet
      .mockReturnValueOnce({ alert_id: 'a1', child_id: 'B-001' })
      .mockReturnValueOnce({ cnt: 0 });

    alert.resolveAlert('a1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes("alert_status = 'none'"))).toBe(true);
  });

  it('does not clear alert_status when pending alerts remain', () => {
    mockGet
      .mockReturnValueOnce({ alert_id: 'a1', child_id: 'B-001' })
      .mockReturnValueOnce({ cnt: 2 });

    alert.resolveAlert('a1');

    const sqlCalls = mockPagesDb.prepare.mock.calls.map(c => c[0]);
    expect(sqlCalls.some(s => s.includes("alert_status = 'none'"))).toBe(false);
  });
});
