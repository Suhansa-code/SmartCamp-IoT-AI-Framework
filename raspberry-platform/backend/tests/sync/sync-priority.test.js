import { describe, it, expect } from 'vitest';
import {
  classifyRowPriority,
  comparePriority,
  priorityIndex,
  PRIORITY,
} from '../../services/sync/sync-priority.js';

// ── pages_alerts ─────────────────────────────────────────────────────────

describe('classifyRowPriority — pages_alerts', () => {
  it('CRITICAL for consecutive flagged alert', () => {
    const r = classifyRowPriority('pages_alerts', { alert_type: '3_consecutive_flagged', status: 'pending' });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
    expect(r.reason).toBe('alert_consecutive');
  });

  it('CRITICAL for 3-of-5 flagged alert', () => {
    const r = classifyRowPriority('pages_alerts', { alert_type: '3_of_5_flagged', status: 'pending' });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
    expect(r.reason).toBe('alert_of_5');
  });

  it('HIGH for pending alert of unknown type', () => {
    const r = classifyRowPriority('pages_alerts', { alert_type: 'other', status: 'pending' });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('alert_pending');
  });

  it('MEDIUM for resolved alert', () => {
    const r = classifyRowPriority('pages_alerts', { alert_type: '3_consecutive_flagged', status: 'resolved' });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
    expect(r.reason).toBe('alert_resolved');
  });
});

// ── pages_sessions ───────────────────────────────────────────────────────

describe('classifyRowPriority — pages_sessions', () => {
  it('HIGH for anomaly flagged session', () => {
    const r = classifyRowPriority('pages_sessions', { anomaly_flagged: 1, gate_decision: 'PASS' });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('session_anomaly');
  });

  it('HIGH for FAIL_CONFIRMED gate', () => {
    const r = classifyRowPriority('pages_sessions', { anomaly_flagged: 0, gate_decision: 'FAIL_CONFIRMED' });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('session_gate_fail');
  });

  it('MEDIUM for FAIL_FIRST gate', () => {
    const r = classifyRowPriority('pages_sessions', { anomaly_flagged: 0, gate_decision: 'FAIL_FIRST' });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
    expect(r.reason).toBe('session_gate_first_fail');
  });

  it('LOW for normal session', () => {
    const r = classifyRowPriority('pages_sessions', { anomaly_flagged: 0, gate_decision: 'PASS' });
    expect(r.priority).toBe(PRIORITY.LOW);
    expect(r.reason).toBe('session_normal');
  });

  it('LOW for session with no gate decision', () => {
    const r = classifyRowPriority('pages_sessions', { anomaly_flagged: 0, gate_decision: null });
    expect(r.priority).toBe(PRIORITY.LOW);
  });
});

// ── pages_gate_decisions ─────────────────────────────────────────────────

describe('classifyRowPriority — pages_gate_decisions', () => {
  it('HIGH for FAIL_CONFIRMED', () => {
    const r = classifyRowPriority('pages_gate_decisions', { decision: 'FAIL_CONFIRMED' });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('gate_fail_confirmed');
  });

  it('MEDIUM for FAIL_FIRST', () => {
    const r = classifyRowPriority('pages_gate_decisions', { decision: 'FAIL_FIRST' });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });

  it('LOW for PASS', () => {
    const r = classifyRowPriority('pages_gate_decisions', { decision: 'PASS' });
    expect(r.priority).toBe(PRIORITY.LOW);
  });
});

// ── persons ──────────────────────────────────────────────────────────────

describe('classifyRowPriority — persons', () => {
  it('CRITICAL for pregnant person', () => {
    const r = classifyRowPriority('persons', { age: 28, is_pregnant: 1, has_chronic_illness: 0 });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
    expect(r.reason).toBe('person_pregnant');
  });

  it('CRITICAL for person with chronic illness', () => {
    const r = classifyRowPriority('persons', { age: 67, is_pregnant: 0, has_chronic_illness: 1 });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
    expect(r.reason).toBe('person_chronic');
  });

  it('HIGH for child (age < 18)', () => {
    const r = classifyRowPriority('persons', { age: 8, is_pregnant: 0, has_chronic_illness: 0 });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('person_child');
  });

  it('HIGH for normal adult', () => {
    const r = classifyRowPriority('persons', { age: 34, is_pregnant: 0, has_chronic_illness: 0 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('HIGH when age is null', () => {
    const r = classifyRowPriority('persons', { age: null, is_pregnant: 0, has_chronic_illness: 0 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });
});

// ── distributions ────────────────────────────────────────────────────────

describe('classifyRowPriority — distributions', () => {
  it('CRITICAL for medicine', () => {
    const r = classifyRowPriority('distributions', { resource_type: 'medicine' });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
    expect(r.reason).toBe('distribution_medicine');
  });

  it('CRITICAL for paracetamol (case insensitive)', () => {
    const r = classifyRowPriority('distributions', { resource_type: 'Paracetamol' });
    expect(r.priority).toBe(PRIORITY.CRITICAL);
  });

  it('HIGH for water', () => {
    const r = classifyRowPriority('distributions', { resource_type: 'water' });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('HIGH for food', () => {
    const r = classifyRowPriority('distributions', { resource_type: 'lunch' });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });
});

// ── resources ────────────────────────────────────────────────────────────

describe('classifyRowPriority — resources', () => {
  it('HIGH when below minimum threshold', () => {
    const r = classifyRowPriority('resources', { available_quantity: 5, minimum_threshold: 20 });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('resource_low_stock');
  });

  it('HIGH when at exactly threshold', () => {
    const r = classifyRowPriority('resources', { available_quantity: 20, minimum_threshold: 20 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('MEDIUM when above threshold', () => {
    const r = classifyRowPriority('resources', { available_quantity: 100, minimum_threshold: 20 });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });
});

// ── pages_children ───────────────────────────────────────────────────────

describe('classifyRowPriority — pages_children', () => {
  it('HIGH for child with low baseline', () => {
    const r = classifyRowPriority('pages_children', { baseline_score: 35, alert_status: 'none', consecutive_low: 0 });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('child_low_baseline');
  });

  it('HIGH for active alert', () => {
    const r = classifyRowPriority('pages_children', { baseline_score: 60, alert_status: 'active', consecutive_low: 0 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('HIGH for consecutive_low >= 2', () => {
    const r = classifyRowPriority('pages_children', { baseline_score: 60, alert_status: 'none', consecutive_low: 3 });
    expect(r.priority).toBe(PRIORITY.HIGH);
    expect(r.reason).toBe('child_consecutive_low');
  });

  it('LOW for normal child', () => {
    const r = classifyRowPriority('pages_children', { baseline_score: 70, alert_status: 'none', consecutive_low: 0 });
    expect(r.priority).toBe(PRIORITY.LOW);
    expect(r.reason).toBe('child_enrolled');
  });
});

// ── fixed-priority tables ───────────────────────────────────────────────

describe('classifyRowPriority — fixed-priority tables', () => {
  it('camp_checkins always HIGH', () => {
    const r = classifyRowPriority('camp_checkins', { id: 1 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('wristbands always HIGH', () => {
    const r = classifyRowPriority('wristbands', { id: 1 });
    expect(r.priority).toBe(PRIORITY.HIGH);
  });

  it('resource_usage always MEDIUM', () => {
    const r = classifyRowPriority('resource_usage', { id: 1 });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });

  it('audit_logs always LOW', () => {
    const r = classifyRowPriority('audit_logs', { id: 1 });
    expect(r.priority).toBe(PRIORITY.LOW);
  });

  it('pages_behavioral_signals always LOW', () => {
    const r = classifyRowPriority('pages_behavioral_signals', { signal_id: 's1' });
    expect(r.priority).toBe(PRIORITY.LOW);
  });

  it('pages_content_responses always LOW', () => {
    const r = classifyRowPriority('pages_content_responses', { response_id: 'r1' });
    expect(r.priority).toBe(PRIORITY.LOW);
  });
});

// ── edge cases ───────────────────────────────────────────────────────────

describe('classifyRowPriority — edge cases', () => {
  it('returns MEDIUM for null row', () => {
    const r = classifyRowPriority('pages_alerts', null);
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });

  it('returns MEDIUM for unknown table', () => {
    const r = classifyRowPriority('unknown_table', { id: 1 });
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });

  it('returns MEDIUM for empty row on unknown table', () => {
    const r = classifyRowPriority('nonexistent', {});
    expect(r.priority).toBe(PRIORITY.MEDIUM);
  });
});

// ── comparePriority ──────────────────────────────────────────────────────

describe('comparePriority', () => {
  it('CRITICAL comes before HIGH', () => {
    const a = { _priority: PRIORITY.CRITICAL, _timestamp: '2026-01-01' };
    const b = { _priority: PRIORITY.HIGH, _timestamp: '2026-01-01' };
    expect(comparePriority(a, b)).toBeLessThan(0);
  });

  it('HIGH comes before MEDIUM', () => {
    const a = { _priority: PRIORITY.HIGH, _timestamp: '2026-01-01' };
    const b = { _priority: PRIORITY.MEDIUM, _timestamp: '2026-01-01' };
    expect(comparePriority(a, b)).toBeLessThan(0);
  });

  it('MEDIUM comes before LOW', () => {
    const a = { _priority: PRIORITY.MEDIUM, _timestamp: '2026-01-01' };
    const b = { _priority: PRIORITY.LOW, _timestamp: '2026-01-01' };
    expect(comparePriority(a, b)).toBeLessThan(0);
  });

  it('same priority: older record first', () => {
    const a = { _priority: PRIORITY.HIGH, _timestamp: '2026-01-01' };
    const b = { _priority: PRIORITY.HIGH, _timestamp: '2026-06-01' };
    expect(comparePriority(a, b)).toBeLessThan(0);
  });

  it('same priority: newer record comes after', () => {
    const a = { _priority: PRIORITY.HIGH, _timestamp: '2026-06-01' };
    const b = { _priority: PRIORITY.HIGH, _timestamp: '2026-01-01' };
    expect(comparePriority(a, b)).toBeGreaterThan(0);
  });

  it('same priority, same timestamp: stable (returns 0)', () => {
    const a = { _priority: PRIORITY.LOW, _timestamp: '2026-01-01' };
    const b = { _priority: PRIORITY.LOW, _timestamp: '2026-01-01' };
    expect(comparePriority(a, b)).toBe(0);
  });

  it('sorts a mixed array correctly', () => {
    const rows = [
      { _priority: PRIORITY.LOW, _timestamp: '2026-01-01' },
      { _priority: PRIORITY.CRITICAL, _timestamp: '2026-06-01' },
      { _priority: PRIORITY.HIGH, _timestamp: '2026-03-01' },
      { _priority: PRIORITY.CRITICAL, _timestamp: '2026-01-01' },
      { _priority: PRIORITY.MEDIUM, _timestamp: '2026-01-01' },
    ];
    rows.sort(comparePriority);
    expect(rows.map(r => r._priority)).toEqual([
      PRIORITY.CRITICAL, PRIORITY.CRITICAL,
      PRIORITY.HIGH,
      PRIORITY.MEDIUM,
      PRIORITY.LOW,
    ]);
    // Within CRITICAL: oldest first
    expect(rows[0]._timestamp).toBe('2026-01-01');
    expect(rows[1]._timestamp).toBe('2026-06-01');
  });
});

// ── priorityIndex ────────────────────────────────────────────────────────

describe('priorityIndex', () => {
  it('returns correct indices', () => {
    expect(priorityIndex(PRIORITY.CRITICAL)).toBe(0);
    expect(priorityIndex(PRIORITY.HIGH)).toBe(1);
    expect(priorityIndex(PRIORITY.MEDIUM)).toBe(2);
    expect(priorityIndex(PRIORITY.LOW)).toBe(3);
  });
});
