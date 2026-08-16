import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMPS,
  CAMP_DETAIL,
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
} from '../../src/data/disaster/camps.data.js';

test('disaster data exposes 14 camps with required fields', () => {
  assert.equal(CAMPS.length, 14);
  for (const camp of CAMPS) {
    assert.ok(camp.id, 'camp has id');
    assert.ok(camp.name, 'camp has name');
    assert.ok(camp.status, 'camp has status');
    assert.ok(camp.type, 'camp has type');
    assert.equal(typeof camp.lat, 'number');
    assert.equal(typeof camp.lng, 'number');
  }
});

test('getDisasterCampById returns camp with detail', () => {
  const galle = getDisasterCampById('galle');
  assert.ok(galle);
  assert.equal(galle.id, 'galle');
  assert.equal(galle.detail.station, 'Baddegama');
});

test('getDisasterCampById returns null for unknown camp', () => {
  assert.equal(getDisasterCampById('nope'), null);
});

test('getDisasterCampSummaries returns plain copies without detail', () => {
  const summaries = getDisasterCampSummaries();
  assert.equal(summaries.length, CAMPS.length);
  assert.equal(summaries[0].detail, undefined);
});

test('getDisasterDashboardSummary aggregates totals and status counts', () => {
  const summary = getDisasterDashboardSummary();
  assert.equal(summary.total_displaced, CAMPS.reduce((s, c) => s + c.displaced, 0));
  assert.equal(summary.camps.length, CAMPS.length);
  assert.equal(summary.map_nodes.length, CAMPS.length);
  assert.ok(summary.status_counts.critical >= 1);
});

test('getDisasterMapNodes returns only map-relevant fields', () => {
  const nodes = getDisasterMapNodes();
  assert.equal(nodes.length, CAMPS.length);
  assert.ok(nodes[0].lat);
  assert.ok(nodes[0].lng);
  assert.equal(nodes[0].displaced, undefined);
});

test('every camp id has a matching detail entry', () => {
  for (const camp of CAMPS) {
    assert.ok(CAMP_DETAIL[camp.id], `detail exists for ${camp.id}`);
  }
});