import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockAxios = { get: vi.fn(), post: vi.fn() };
vi.mock('axios', () => ({ default: mockAxios }));

let C, scoring;

beforeAll(async () => {
  C = (await import('../../config/constants.js')).default;
  scoring = await import('../../services/education/scoring.js');
});

describe('computeTaskScore', () => {
  it('returns 100 for perfect performance', () => {
    const score = scoring.computeTaskScore({
      accuracyRate: 1.0, falseTapRate: 0,
      avgReactionTime: 0, reactionVariance: 0,
    });
    expect(score).toBe(100);
  });

  it('returns negative for worst performance (no internal clamp)', () => {
    const score = scoring.computeTaskScore({
      accuracyRate: 0, falseTapRate: 2,
      avgReactionTime: 5000, reactionVariance: 5000,
    });
    expect(score).toBeLessThan(0);
  });

  it('uses defaults for missing fields', () => {
    const score = scoring.computeTaskScore({});
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('weights accuracyRate as 40%', () => {
    const high = scoring.computeTaskScore({ accuracyRate: 1.0, falseTapRate: 0, avgReactionTime: 100, reactionVariance: 50 });
    const low  = scoring.computeTaskScore({ accuracyRate: 0.5, falseTapRate: 0, avgReactionTime: 100, reactionVariance: 50 });
    expect(high).toBeGreaterThan(low);
  });
});

describe('computePassiveScore', () => {
  it('returns 100 for perfect engagement', () => {
    const score = scoring.computePassiveScore({
      idleTimeRatio: 0, rapidClickCount: 0, completionRatio: 1,
    });
    expect(score).toBe(100);
  });

  it('returns 0 for worst engagement', () => {
    const score = scoring.computePassiveScore({
      idleTimeRatio: 1, rapidClickCount: 20, completionRatio: 0,
    });
    expect(score).toBe(0);
  });

  it('defaults all missing fields to ideal values', () => {
    const score = scoring.computePassiveScore({});
    expect(score).toBe(100);
  });
});

describe('fallbackScore', () => {
  it('returns PASS when composite >= threshold', () => {
    const result = scoring.fallbackScore(
      { accuracyRate: 0.9, falseTapRate: 0.1, avgReactionTime: 300, reactionVariance: 200 },
      { idleTimeRatio: 0.2, rapidClickCount: 1, completionRatio: 0.9 },
    );
    expect(result.gateDecision).toBe('PASS');
    expect(result.compositeScore).toBeGreaterThanOrEqual(C.GATE_THRESHOLD);
    expect(result.zScore).toBeNull();
    expect(result.anomalyFlagged).toBe(false);
  });

  it('returns FAIL_FIRST when composite < threshold', () => {
    const result = scoring.fallbackScore(
      { accuracyRate: 0.3, falseTapRate: 0.6, avgReactionTime: 700, reactionVariance: 400 },
      { idleTimeRatio: 0.8, rapidClickCount: 8, completionRatio: 0.3 },
    );
    expect(result.gateDecision).toBe('FAIL_FIRST');
    expect(result.compositeScore).toBeLessThan(C.GATE_THRESHOLD);
  });

  it('uses baselineOverride when provided', () => {
    const result = scoring.fallbackScore(
      { accuracyRate: 0.5, falseTapRate: 0.3, avgReactionTime: 400, reactionVariance: 250 },
      { idleTimeRatio: 0.3, rapidClickCount: 2, completionRatio: 0.8 },
      80,
    );
    expect(result.baselineScore).toBe(80);
  });

  it('returns safe defaults on internal error', () => {
    const result = scoring.fallbackScore(null, null);
    expect(result.compositeScore).toBe(50);
    expect(result.gateDecision).toBe('PASS');
  });
});

describe('checkFlaskHealth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns true when Flask responds ok', async () => {
    mockAxios.get.mockResolvedValue({ data: { status: 'ok' } });
    await expect(scoring.checkFlaskHealth()).resolves.toBe(true);
  });

  it('returns false when Flask responds not ok', async () => {
    mockAxios.get.mockResolvedValue({ data: { status: 'error' } });
    await expect(scoring.checkFlaskHealth()).resolves.toBe(false);
  });

  it('returns false on network error', async () => {
    mockAxios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(scoring.checkFlaskHealth()).resolves.toBe(false);
  });
});

describe('getScore', () => {
  beforeEach(() => vi.clearAllMocks());

  const taskMetrics = { accuracyRate: 0.85, falseTapRate: 0.1, avgReactionTime: 350, reactionVariance: 200 };
  const passiveSignals = { idleTimeRatio: 0.15, rapidClickCount: 1, completionRatio: 0.95 };

  it('returns Flask score on success', async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        compositeScore: 78, taskScore: 82, passiveScore: 72,
        baselineScore: 65, zScore: 0.5, ifScore: 0.2,
        anomalyFlagged: false, gateDecision: 'PASS',
      },
    });
    const result = await scoring.getScore('C-001', 'sess-1', taskMetrics, passiveSignals);
    expect(result.compositeScore).toBe(78);
    expect(result.gateDecision).toBe('PASS');
  });

  it('falls back to local scoring when Flask fails', async () => {
    mockAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await scoring.getScore('C-001', 'sess-1', taskMetrics, passiveSignals);
    expect(result.zScore).toBeNull();
    expect(result.ifScore).toBeNull();
    expect(result.anomalyFlagged).toBe(false);
    expect(result.compositeScore).toBeGreaterThan(0);
  });

  it('passes baselineOverride to fallback', async () => {
    mockAxios.post.mockRejectedValue(new Error('timeout'));
    const result = await scoring.getScore('C-001', 'sess-1', taskMetrics, passiveSignals, 90);
    expect(result.baselineScore).toBe(90);
  });
});
