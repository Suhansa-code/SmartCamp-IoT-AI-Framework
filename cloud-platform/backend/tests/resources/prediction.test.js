import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computePrediction } from '../../src/services/resources/prediction.service.js';

test('computePrediction with no snapshots uses 85% attendance default', () => {
  const result = computePrediction({ snapshots: [], totalPersons: 100 });
  assert.equal(result.expected_new_arrivals, 0);
  assert.equal(result.confidence, 'LOW');
  assert.equal(result.expected_persons, 85);
});

test('computePrediction confidence tiers', () => {
  const makeSnapshots = (n) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      total_persons: 100 + i * 5,
    }));

  const few = computePrediction({ snapshots: makeSnapshots(2), totalPersons: 100 });
  assert.equal(few.confidence, 'LOW');

  const med = computePrediction({ snapshots: makeSnapshots(5), totalPersons: 100 });
  assert.equal(med.confidence, 'MEDIUM');

  const high = computePrediction({ snapshots: makeSnapshots(10), totalPersons: 100 });
  assert.equal(high.confidence, 'HIGH');
});

test('computePrediction returns expected shape', () => {
  const result = computePrediction({ snapshots: [], totalPersons: 50 });
  assert.ok(typeof result.expected_new_arrivals === 'number');
  assert.ok(typeof result.expected_persons === 'number');
  assert.ok(typeof result.confidence === 'string');
});
