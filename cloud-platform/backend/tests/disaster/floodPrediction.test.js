import { test } from 'node:test';
import assert from 'node:assert/strict';

import { toNumber, buildInput } from '../../src/services/disaster/floodPrediction.service.js';
import { getDisasterCampById } from '../../src/data/disaster/camps.data.js';

test('toNumber falls back to default for invalid values', () => {
  assert.equal(toNumber(10), 10);
  assert.equal(toNumber('12.5'), 12.5);
  assert.equal(toNumber('abc'), 0);
  assert.equal(toNumber(undefined, 7), 7);
});

test('buildInput maps camp + detail fields into model input', () => {
  const camp = getDisasterCampById('galle');
  const input = buildInput(camp);

  assert.equal(input.longitude, camp.lng);
  assert.equal(input.latitude, camp.lat);
  assert.equal(input.rainfall_mm, camp.detail.rain);
  assert.equal(input.nearest_river_m, camp.detail.stDist);
  assert.equal(input.gauging_station_current_water_level_m, camp.detail.wl);
  assert.equal(input.is_forecast, true);
});

test('buildInput tolerates a camp with no detail', () => {
  const input = buildInput({ id: 'x', lat: 1, lng: 2 });
  assert.equal(input.rainfall_mm, 0);
  assert.equal(input.longitude, 2);
  assert.equal(input.is_forecast, true);
});

test('buildInput normalises missing numeric fields', () => {
  const input = buildInput({ lat: 'not-a-number', lng: null, detail: { rain: 'abc', wl: undefined } });
  assert.equal(input.latitude, 0);
  assert.equal(input.longitude, 0);
  assert.equal(input.rainfall_mm, 0);
  assert.equal(input.gauging_station_current_water_level_m, 0);
});