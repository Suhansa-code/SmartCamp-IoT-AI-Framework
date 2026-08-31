/**
 * Alias-based standardisation, and the matching it feeds.
 *
 * These tests are written against the failures that motivated the layer, so a
 * regression names the exact defect it reintroduced rather than reporting a
 * changed number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  standardize, canonicalKey, CLASS, getAliasProvenance,
} from '../../src/services/resources/commodityStandardizer.service.js';
import { shareFor } from '../../src/services/resources/commodityShares.service.js';
import { computeStockOutlook } from '../../src/services/resources/stockRunout.service.js';

// ── normalisation ──────────────────────────────────────────────────────────

test('canonical key is insensitive to case, punctuation and parentheticals', () => {
  assert.equal(canonicalKey('DHAL'), 'dhal');
  assert.equal(canonicalKey('Dhal (Red Lentils)'), 'dhal');
  assert.equal(canonicalKey('  dhal!!  '), 'dhal');
});

test('pack sizes and container words are stripped', () => {
  for (const name of ['Rice 5kg', 'Rice 25 kg bag', 'Rice (White) 25kg sack', 'RICE - 1 bag']) {
    assert.equal(canonicalKey(name), 'rice', `${name} should reduce to "rice"`);
  }
});

test('token order does not matter, so "Milk Powder" is "Powdered milk"', () => {
  assert.equal(canonicalKey('Milk Powder'), canonicalKey('Powdered milk'));
});

test('plurals are stripped, including the -oes case', () => {
  assert.equal(canonicalKey('Potatoes'), 'potato');
  assert.equal(canonicalKey('Tomatoes'), 'tomato');
  assert.equal(canonicalKey('Onions'), 'onion');
  assert.equal(canonicalKey('Cowpeas'), 'cowpea');
});

test('short and -us words are left alone by singularisation', () => {
  assert.equal(canonicalKey('gas'), 'gas');       // too short to touch
  assert.equal(canonicalKey('hummus'), 'hummus'); // -us is guarded
});

test('normalisation is symmetric and stable, which is what matching needs', () => {
  // Both sides of a match go through the same function, so a rule that mangles
  // a word mangles it identically on both sides. "Molasses" -> "molass" is not
  // English, but it is the SAME non-English on the store name and the survey
  // name, so the two still meet. What would break matching is asymmetry.
  for (const name of ['Molasses', 'Cowpeas', 'Milk Powder', 'Rice 5kg', 'Dhal (Red Lentils)']) {
    const once = canonicalKey(name);
    assert.equal(canonicalKey(once), once, `${name}: key must be stable when re-applied`);
    assert.equal(canonicalKey(name.toUpperCase()), once, `${name}: key must not depend on case`);
  }
});

// ── classification ─────────────────────────────────────────────────────────

test('classes are assigned from the alias lists', () => {
  assert.equal(standardize('Drinking Water 20L').klass, CLASS.WATER);
  assert.equal(standardize('Tarpaulin').klass, CLASS.NON_FOOD);
  assert.equal(standardize('Tea').klass, CLASS.BEVERAGE);
  assert.equal(standardize('Cooking Oil').klass, CLASS.FOOD);
});

test('a single listed token classifies a longer name', () => {
  assert.equal(standardize('Tarpaulin Sheet').klass, CLASS.NON_FOOD);
  assert.equal(standardize('Water Bowser Load').klass, CLASS.WATER);
});

test('an unrecognised name is UNKNOWN, never assumed to be food', () => {
  const s = standardize('Zzyzx');
  assert.equal(s.klass, CLASS.UNKNOWN);
  assert.equal(s.targets, null);
});

// ── matching ───────────────────────────────────────────────────────────────

test('REGRESSION: "Ice" no longer matches "White rice"', () => {
  // Substring containment gave an ice item 23.5 % of the entire food basket,
  // because "ice" is inside "r-ice". Matching now compares whole words.
  const m = shareFor('Ice');
  assert.notEqual(m?.commodity, 'White rice');
  assert.ok((m?.share ?? 0) < 0.05, 'an ice item must not carry a staple-sized share');
});

test('names that used to miss entirely now match', () => {
  const cases = {
    'Milk Powder':  'Powdered milk',
    'Potatoes':     'White or yellow fleshed potato',
    'Cooking Oil':  'Coconut oil',
    'Dried Sprats': 'Dried small fish (e.g., sprats, keeramin)',
    'Lentils':      'Dhal - masoor/red',
    'Rice 5kg':     'White rice',
  };
  for (const [name, commodity] of Object.entries(cases)) {
    const m = shareFor(name);
    assert.ok(m, `${name} should match something`);
    assert.equal(m.commodity, commodity, `${name} -> ${m.commodity}`);
  }
});

test('the matching stage that fired is reported', () => {
  assert.equal(shareFor('Coconut Oil').match, 'exact');       // survey's own name
  assert.equal(shareFor('Cooking Oil').match, 'alias');       // curated mapping
  assert.equal(shareFor('Potatoes').match, 'token_subset');   // words line up
  assert.equal(shareFor('Coconut Oil').confidence, 'high');
  assert.equal(shareFor('Potatoes').confidence, 'medium');
});

test('a group alias sums its members and keeps the largest as the label', () => {
  const rice = shareFor('Rice');
  assert.deepEqual(rice.commodities, ['White rice', 'Red rice']);
  assert.equal(rice.commodity, 'White rice', 'largest member labels the group');
  const white = shareFor('White rice').share;
  const red = shareFor('Red rice').share;
  assert.ok(Math.abs(rice.share - (white + red)) < 1e-9, 'group share is the sum');
  assert.ok(rice.share > white, 'a generic "Rice" line draws more than white rice alone');
});

test('non-basket classes are refused a share rather than given one', () => {
  for (const name of ['Tarpaulin', 'Paracetamol', 'Tea', 'Drinking Water']) {
    assert.equal(shareFor(name), null, `${name} must not be handed a food share`);
  }
});

// ── the effect on the outlook ──────────────────────────────────────────────

const history = [
  { date: '2026-09-01', population: 90 },
  { date: '2026-09-02', population: 112 },
  { date: '2026-09-03', population: 131 },
  { date: '2026-09-04', population: 150 },
];

const outlook = (resources) =>
  computeStockOutlook({ resources, history, currentPopulation: 150, horizonDays: 30, leadTimeDays: 3 });

test('a food item filed under a non-food category is still forecast', () => {
  // The Pi seeds "Milk" with category "Beverage". The category test alone read
  // that as non-consumable and gave it no runout date at all.
  const milk = outlook([
    { id: 1, resource_name: 'Milk', category: 'Beverage', unit: 'kg', available_quantity: 40, minimum_threshold: 5 },
  ]).items[0];
  assert.equal(milk.forecastable, true);
  assert.equal(milk.kind, 'food');
  assert.ok(milk.runout_date);
});

test('a beverage is refused with the exclusion stated, not left unexplained', () => {
  const tea = outlook([
    { id: 1, resource_name: 'Tea', category: 'Food', unit: 'kg', available_quantity: 40, minimum_threshold: 5 },
  ]).items[0];
  assert.equal(tea.forecastable, false);
  assert.equal(tea.standardisation.classified_as, CLASS.BEVERAGE);
  assert.match(tea.note, /double-count/);
});

test('a non-food filed under FOOD fails closed', () => {
  const tarp = outlook([
    { id: 1, resource_name: 'Tarpaulin', category: 'FOOD', unit: 'kg', available_quantity: 40, minimum_threshold: 5 },
  ]).items[0];
  assert.equal(tarp.forecastable, false, 'the category must not override a known non-consumable');
});

test('one commodity is claimed once, even when two lines name it', () => {
  const o = outlook([
    { id: 1, resource_name: 'Rice',     category: 'FOOD', unit: 'kg', available_quantity: 500, minimum_threshold: 50 },
    { id: 2, resource_name: 'Red rice', category: 'FOOD', unit: 'kg', available_quantity: 100, minimum_threshold: 10 },
  ]);
  // "Rice" claims {White rice, Red rice}; the second line adds nothing new.
  assert.equal(o.allocation.commodities_claimed, 2);
  assert.ok(Math.abs(o.allocation.claimed_share - shareFor('Rice').share) < 1e-9);
  assert.equal(o.allocation.claimed_share + o.allocation.unallocated_share, 1);
});

test('only unmatched FOOD splits the remainder', () => {
  const o = outlook([
    { id: 1, resource_name: 'Rice',        category: 'FOOD',    unit: 'kg', available_quantity: 500, minimum_threshold: 50 },
    { id: 2, resource_name: 'Curry Powder', category: 'FOOD',   unit: 'kg', available_quantity: 20,  minimum_threshold: 5 },
    { id: 3, resource_name: 'Tarpaulin',   category: 'SHELTER', unit: 'pc', available_quantity: 30,  minimum_threshold: 5 },
    { id: 4, resource_name: 'Tea',         category: 'FOOD',    unit: 'kg', available_quantity: 10,  minimum_threshold: 2 },
  ]);
  assert.equal(o.allocation.unmatched_food, 1, 'only the curry powder is unmatched food');
  assert.equal(o.allocation.remainder_each, o.allocation.unallocated_share);
  const curry = o.items.find((i) => i.resource_name === 'Curry Powder');
  assert.ok(curry.warnings.some((w) => w.includes('unallocated')));
});

test('every item carries the standardisation that produced its number', () => {
  const o = outlook([
    { id: 1, resource_name: 'Rice 25kg bag', category: 'FOOD', unit: 'kg', available_quantity: 500, minimum_threshold: 50 },
  ]);
  const s = o.items[0].standardisation;
  assert.equal(s.raw_name, 'Rice 25kg bag');
  assert.equal(s.canonical_name, 'rice');
  assert.equal(s.classified_as, CLASS.FOOD);
  assert.equal(s.match_rule, 'alias');
  assert.equal(s.match_confidence, 'high');
  assert.deepEqual(o.items[0].commodities_matched, ['White rice', 'Red rice']);
});

test('alias provenance is reported so the curated layer is auditable', () => {
  const p = getAliasProvenance();
  assert.equal(p.evidence, 'curated');
  assert.ok(p.counts.aliases > 0);
  assert.ok(p.evidence_note.length > 0, 'curated must be distinguishable from measured');
});
