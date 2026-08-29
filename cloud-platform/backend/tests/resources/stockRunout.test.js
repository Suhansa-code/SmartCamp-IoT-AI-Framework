import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeStockOutlook } from '../../src/services/resources/stockRunout.service.js';
import { shareFor } from '../../src/services/resources/commodityShares.service.js';

const history = [
  { date: '2026-09-01', population: 90 },
  { date: '2026-09-02', population: 112 },
  { date: '2026-09-03', population: 131 },
  { date: '2026-09-04', population: 150 },
];

const resources = [
  { id: 1, resource_name: 'Rice', category: 'FOOD', unit: 'kg', available_quantity: 500, minimum_threshold: 100 },
  { id: 2, resource_name: 'Dhal', category: 'FOOD', unit: 'kg', available_quantity: 60, minimum_threshold: 20 },
  { id: 3, resource_name: 'Drinking Water', category: 'WATER', unit: 'L', available_quantity: 4000, minimum_threshold: 500 },
  { id: 4, resource_name: 'Blankets', category: 'SHELTER', unit: 'piece', available_quantity: 200, minimum_threshold: 50 },
];

const outlook = () =>
  computeStockOutlook({ resources, history, currentPopulation: 150, horizonDays: 30, leadTimeDays: 3 });

test('commodity names from a camp store match survey items', () => {
  assert.equal(shareFor('Rice').commodity, 'White rice');
  assert.equal(shareFor('Coconut Oil').match, 'exact');
  assert.equal(shareFor('Tarpaulin'), null);
});

test('every forecastable item gets a runout and reorder date', () => {
  const o = outlook();
  for (const item of o.items.filter((i) => i.forecastable)) {
    assert.ok(item.runout_date, `${item.resource_name} has no runout date`);
    assert.ok(item.reorder_by, `${item.resource_name} has no reorder date`);
    assert.ok(item.days_cover >= 0);
    // Reorder must land before the store empties, by the lead time.
    assert.ok(item.reorder_by < item.runout_date);
  }
});

test('non-consumable items are not given a fabricated runout date', () => {
  const blankets = outlook().items.find((i) => i.resource_name === 'Blankets');
  assert.equal(blankets.forecastable, false);
  assert.equal(blankets.status, 'UNKNOWN');
  assert.equal(blankets.runout_date, null);
  assert.equal(blankets.days_cover, null);
});

test('a growing camp empties stock sooner than a flat headcount would', () => {
  const o = outlook();
  const rice = o.items.find((i) => i.resource_name === 'Rice');
  // Flat-headcount cover: stock divided by today's draw rate.
  const naiveDays = rice.available_quantity / rice.daily_use_now;
  assert.ok(
    rice.days_cover < naiveDays,
    `forecast cover ${rice.days_cover} should be under naive ${naiveDays.toFixed(1)}`,
  );
});

test('status is driven by cover against lead time, not the level threshold', () => {
  const o = computeStockOutlook({
    resources: [
      // Well above its minimum_threshold, but only about a day of cover.
      { id: 9, resource_name: 'Rice', category: 'FOOD', unit: 'kg', available_quantity: 50, minimum_threshold: 1 },
    ],
    history,
    currentPopulation: 150,
    horizonDays: 30,
    leadTimeDays: 3,
  });
  const rice = o.items[0];
  assert.ok(rice.available_quantity > rice.minimum_threshold, 'above the level threshold');
  assert.equal(rice.status, 'CRITICAL', 'but critical on cover');
});

test('a unit that is not kg or litres raises a warning', () => {
  const o = computeStockOutlook({
    resources: [
      { id: 7, resource_name: 'Rice', category: 'FOOD', unit: 'portion', available_quantity: 500, minimum_threshold: 10 },
    ],
    history,
    currentPopulation: 150,
  });
  assert.ok(o.items[0].warnings.some((w) => w.includes('portion')));
});

test('items are ordered most urgent first', () => {
  const rank = { CRITICAL: 0, LOW: 1, AVAILABLE: 2, UNKNOWN: 3 };
  const statuses = outlook().items.map((i) => rank[i.status]);
  assert.deepEqual(statuses, [...statuses].sort((a, b) => a - b));
});

test('the forecast basis is reported alongside the numbers', () => {
  const o = outlook();
  assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(o.population.confidence));
  assert.ok(o.population.note.length > 0);
  assert.ok(o.provenance.commodity_shares.includes('BRIGHT'));
  assert.equal(o.lead_time_days, 3);
});
