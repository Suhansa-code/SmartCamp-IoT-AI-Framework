import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePrediction, linearWeightedAvg } from '../../src/services/resources/prediction.service.js';

test('linearWeightedAvg gives recent values more weight', () => {
  // [1, 2, 3] → (1*1 + 2*2 + 3*3) / (1+2+3) = 14/6 ≈ 2.333
  assert.ok(Math.abs(linearWeightedAvg([1, 2, 3]) - 14 / 6) < 1e-9);
});

test('computePrediction with no snapshots falls back to 10% growth', () => {
  const result = computePrediction({ snapshots: [], totalPersons: 100 });
  assert.equal(result.expected_new_arrivals, 10);
  assert.equal(result.confidence, 'LOW');
  assert.equal(result.expected_persons, Math.ceil(110 * 0.85));
});

test('computePrediction confidence tiers', () => {
  const makeSnapshots = (n) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      total_persons: 100 + i,
      new_registrations: 2,
      checkins: 80,
      distributions: {},
    }));

  assert.equal(computePrediction({ snapshots: makeSnapshots(1) }).confidence, 'LOW');
  assert.equal(computePrediction({ snapshots: makeSnapshots(5) }).confidence, 'MEDIUM');
  assert.equal(computePrediction({ snapshots: makeSnapshots(9) }).confidence, 'HIGH');
});

test('computePrediction adds vulnerable-person extras', () => {
  const result = computePrediction({ snapshots: [], totalPersons: 100, pregnant: 10, chronic: 5 });
  assert.ok(result.lunch_kg > 0);
  assert.ok(result.water_litres > 0);
});

test('computePrediction attendance rate is clamped', () => {
  const snapshots = [
    { date: '2026-01-01', total_persons: 100, new_registrations: 0, checkins: 5, distributions: {} },
    { date: '2026-01-02', total_persons: 100, new_registrations: 0, checkins: 8, distributions: {} },
  ];
  const result = computePrediction({ snapshots, totalPersons: 100 });
  assert.ok(result.attendance_rate_pct >= 50);
  assert.ok(result.attendance_rate_pct <= 99);
});