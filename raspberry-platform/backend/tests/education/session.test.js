import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn(() => []);
const mockTransaction = vi.fn((fn) => fn());

const mockPagesDb = {
  prepare: vi.fn(() => ({ run: mockRun, get: mockGet, all: mockAll })),
  transaction: mockTransaction,
};

const mockCampDb = {
  prepare: vi.fn(() => ({
    get: vi.fn(() => null),
    run: mockRun,
  })),
};

let mockSqliteRetrieve = vi.fn(() => []);

vi.mock('../../config/database.js', () => ({
  pagesDb: mockPagesDb,
  campDb: mockCampDb,
  sqliteInsert: vi.fn(),
  sqliteUpdate: vi.fn(),
  sqliteRetrieve: (...args) => mockSqliteRetrieve(...args),
  sqliteGetLastChildId: vi.fn(),
}));

vi.mock('../../config/constants.js', () => ({
  default: {
    CAMP_ID: 'CAMP-TEST',
    GATE_THRESHOLD: 55,
    GATE: { PASS: 'PASS', FAIL_FIRST: 'FAIL_FIRST', FAIL_CONFIRMED: 'FAIL_CONFIRMED' },
  },
}));

vi.mock('../../utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/helpers.js', () => ({
  newId: vi.fn(() => 'TEST-ID-001'),
  todayDate: vi.fn(() => '2026-08-26'),
  nowTime: vi.fn(() => '14:30:00'),
  nowISO: vi.fn(() => '2026-08-26T14:30:00.000Z'),
}));

vi.mock('../../middleware/error-handler.js', () => ({
  createError: vi.fn((status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
  }),
}));

vi.mock('../../services/education/scoring.js', () => ({
  getScore: vi.fn(async () => ({
    compositeScore: 72,
    taskScore: 75,
    passiveScore: 68,
    zScore: 0.5,
    ifScore: 0.3,
  })),
}));

vi.mock('../../services/education/gating.js', () => ({
  applyFirstGate: vi.fn(() => 'PASS'),
  applySecondGate: vi.fn(() => 'PASS'),
  updateBaseline: vi.fn((old, score) => old),
}));

vi.mock('../../services/education/alert.js', () => ({
  checkAndCreateAlert: vi.fn(),
}));

vi.mock('../../services/sync/sync-notify.js', () => ({
  enqueueSync: vi.fn(),
  enqueueSyncBatch: vi.fn(),
}));

let session;

beforeEach(async () => {
  vi.clearAllMocks();
  mockGet.mockReset();
  mockAll.mockReset();
  mockRun.mockReset();
  mockGet.mockReturnValue(null);
  mockAll.mockReturnValue([]);

  session = await import('../../controllers/education/session.js');
});

describe('session controller', () => {
  describe('startSession', () => {
    const mockReq = { body: { person_id: 'PERSON-001', condition_label: 'A' } };
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };
      mockNext = vi.fn();
    });

    it('returns 404 when child not found', async () => {
      mockGet.mockReturnValue(null);
      await session.startSession(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it('returns 201 with session data on success', async () => {
      mockSqliteRetrieve.mockImplementation((table, cols, where, params) => {
        if (table === 'pages_children') {
          return [{
            child_id: 'CHILD-001',
            grade: 3,
            language: 'si',
            total_sessions: 2,
            baseline_score: 60,
          }];
        }
        return [];
      });
      await session.startSession(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          child_id: 'CHILD-001',
          session_number: 3,
        })
      );
    });
  });

  describe('taskComplete', () => {
    const mockReq = {
      body: {
        child_id: 'CHILD-001',
        session_id: 'SESS-001',
        attempt: 1,
        taskMetrics: {
          accuracyRate: 0.8,
          falseTapRate: 0.1,
          avgReactionTime: 500,
          reactionVariance: 100,
        },
        passiveSignals: {
          idleTimeRatio: 0.2,
          rapidClickCount: 0,
          timeToFirstMs: 300,
          completionRatio: 0.9,
        },
      },
    };
    let mockRes;
    let mockNext;

    beforeEach(() => {
      mockRes = {
        status: vi.fn(() => mockRes),
        json: vi.fn(),
      };
      mockNext = vi.fn();
      mockGet.mockReturnValue({
        session_id: 'SESS-001',
        child_id: 'CHILD-001',
        baseline_score_used: 60,
      });
    });

    it('returns 404 when session not found', async () => {
      mockGet.mockReturnValue(null);
      await session.taskComplete(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
    });

    it('returns success with gate decision', async () => {
      mockSqliteRetrieve.mockImplementation((table, cols, where, params) => {
        if (table === 'pages_sessions') {
          return [{
            session_id: 'SESS-001',
            child_id: 'CHILD-001',
            baseline_score_used: 60,
            gate_decision: null,
          }];
        }
        if (table === 'pages_children') {
          return [{
            child_id: 'CHILD-001',
            baseline_score: 60,
            total_sessions: 2,
            consecutive_low: 0,
          }];
        }
        return [];
      });
      await session.taskComplete(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          gate_decision: 'PASS',
          composite_score: 72,
        })
      );
    });
  });
});
