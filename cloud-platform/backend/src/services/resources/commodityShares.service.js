/**
 * CommodityShares — per-item share of the daily food basket, and the matcher
 * that decides which share a camp store line is entitled to.
 *
 * The share table is built by prediction-models/scripts/build_commodity_shares.py
 * from the BRIGHT Sri Lanka household survey (mod_j1_fah_long, 131 items, 7-day
 * recall), with beverages excluded so they are not counted twice against the
 * separate drinking-water allowance.
 *
 * This is what turns one food_kg_day figure into "rice runs out Wednesday,
 * dhal holds until Sunday". Stock is held per commodity; demand is not, so the
 * basket shares are the bridge between them.
 *
 * ── Matching is now staged, and every stage is named in the result ───────────
 *
 * Matching used to be one fuzzy comparison: normalise both names, try an exact
 * hit, then fall back to raw substring containment in either direction. That
 * conflated three different questions and reported all of them identically, as
 * `match: 'partial'`. It failed in both directions at once:
 *
 *   missed   "Milk Powder" vs "Powdered milk" — same words, wrong order
 *            "Potatoes" vs "White or yellow fleshed potato" — plural
 *            "Rice 5kg" — a pack size on the end defeats containment
 *   invented "Ice" matched "White rice", because "ice" is a substring of
 *            "r-ice", and was handed 23.5 % of the entire food basket
 *
 * The stages below are ordered by how much evidence each needs, strongest
 * first, and the winner is reported so the UI and the operator can see which
 * one fired:
 *
 *   1. exact          canonical keys are identical                    high
 *   2. alias          the curated table names the mapping             high
 *   3. token_subset   every store word appears in the commodity       medium
 *                     ("potato" in "white or yellow fleshed potato")
 *   4. token_superset every commodity word appears in the store name  medium
 *                     ("premium white rice" covers "white rice")
 *   5. null           nothing matched; the caller applies the
 *                     unallocated remainder and says that it did
 *
 * Substring containment is gone entirely. Stages 3 and 4 compare WORDS, so
 * "ice" can no longer reach "rice": a token either is in the set or is not.
 * That single change is what removes the whole false-positive class, and it is
 * why the alias table can afford to be conservative — it no longer has to
 * compete with a matcher that says yes to almost anything.
 *
 * ── Groups ──────────────────────────────────────────────────────────────────
 *
 * An alias may name several commodities, and their shares are summed. A store
 * line reading "Rice" is drawn down by everyone eating white rice AND red rice,
 * so pricing it at white rice alone (23.5 %) under-states the draw by a third
 * against the true 31.4 %. `commodity` stays the largest member for display and
 * for callers that expect a single name; `commodities` carries the full group.
 */
import fs from 'fs';
import { env } from '../../config/env.js';
import { standardize, canonicalKey, canonicalTokens, CLASS } from './commodityStandardizer.service.js';

let cache = null;

function load() {
  const path = env.resources.commoditySharesPath;
  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `Commodity share table not found at ${path}. ` +
        'Run: python scripts/build_commodity_shares.py in cloud-platform/prediction-models, ' +
        `or set COMMODITY_SHARES_PATH. (${err.code})`,
    );
  }
  const table = JSON.parse(raw);
  if (!table.shares || typeof table.shares !== 'object') {
    throw new Error(`Commodity share table at ${path} has no shares object`);
  }
  console.log(
    `[Commodities] ${Object.keys(table.shares).length} shares loaded ` +
      `(${table.basis})`,
  );
  return table;
}

export function getShares() {
  if (!cache) cache = load();
  return cache;
}

export function reloadShares() {
  cache = null;
  index = null;
  return getShares();
}

// ── the canonical index ────────────────────────────────────────────────────

let index = null;

/**
 * Canonicalise every survey commodity once, through the SAME normaliser the
 * store name goes through. Both sides must be reduced by identical rules or the
 * comparison is meaningless — that is the whole point of standardising first
 * rather than fuzz-matching two differently-shaped strings.
 */
function getIndex() {
  if (index) return index;
  const shares = getShares().shares;
  const entries = Object.entries(shares).map(([name, share]) => ({
    name,
    share,
    key: canonicalKey(name),
    tokens: new Set(canonicalTokens(name)),
  }));

  const byKey = new Map();
  for (const e of entries) {
    if (!e.key) continue;
    if (!byKey.has(e.key)) byKey.set(e.key, []);
    byKey.get(e.key).push(e);
  }

  index = { entries, byKey };
  return index;
}

/** Assemble a result from a set of matched commodities, summing their shares. */
function group(matches, rule, confidence, std) {
  if (!matches.length) return null;
  const sorted = [...matches].sort((a, b) => b.share - a.share);
  return {
    // Largest member first: existing callers read `commodity` as one name.
    commodity: sorted[0].name,
    commodities: sorted.map((m) => m.name),
    share: sorted.reduce((s, m) => s + m.share, 0),
    match: rule,
    confidence,
    standardized: {
      raw: std.raw,
      canonical: std.canonical,
      klass: std.klass,
      rule: std.rule,
      note: std.note,
    },
  };
}

/**
 * Match a camp store resource name to its share of the food basket.
 *
 * Returns null when nothing matches — deliberately, so the caller can apply the
 * unallocated remainder and report that it did, rather than silently assigning
 * a wrong share. Also returns null for anything the standardiser classified as
 * water, a non-food, or an excluded beverage: those are not basket items and
 * must not be handed a share.
 *
 * @param {string} resourceName
 * @returns {null | { commodity, commodities, share, match, confidence, standardized }}
 */
export function shareFor(resourceName) {
  const std = standardize(resourceName);
  if (!std.canonical) return null;

  // A class the basket does not price. Handing these a share is exactly the
  // double count the beverage exclusion was built to prevent.
  if (std.klass === CLASS.WATER || std.klass === CLASS.NON_FOOD || std.klass === CLASS.BEVERAGE) {
    return null;
  }

  const { entries, byKey } = getIndex();

  // 1. exact — identical canonical keys.
  const exact = byKey.get(std.canonical);
  if (exact) return group(exact, 'exact', 'high', std);

  // 2. alias — the curated table names the commodities outright.
  if (std.targets?.length) {
    const named = std.targets
      .map((name) => entries.find((e) => e.name === name))
      .filter(Boolean);
    if (named.length) return group(named, 'alias', 'high', std);
    // An alias pointing at a commodity the shares table no longer has. The
    // validator exists to stop this reaching production; if it does, fall
    // through to the weaker stages rather than returning a zero share.
    console.warn(
      `[Commodities] alias "${std.canonical}" names ${std.targets.length} commodit(ies), ` +
        'none present in the shares table — run validate_commodity_aliases.py',
    );
  }

  const tokens = new Set(std.tokens);

  // 3. token_subset — every store word appears in the commodity name.
  //    "potato" -> "White or yellow fleshed potato".
  const subset = entries.filter((e) => [...tokens].every((t) => e.tokens.has(t)));
  if (subset.length) {
    // Largest share wins: a bare "rice" should land on white rice, not on a
    // 0.2 % rice product that happens to share the word.
    const best = subset.reduce((a, b) => (b.share > a.share ? b : a));
    return group([best], 'token_subset', 'medium', std);
  }

  // 4. token_superset — every commodity word appears in the store name.
  //    "premium white rice 25kg" -> "White rice".
  const superset = entries.filter((e) => [...e.tokens].every((t) => tokens.has(t)));
  if (superset.length) {
    const best = superset.reduce((a, b) => (b.share > a.share ? b : a));
    return group([best], 'token_superset', 'medium', std);
  }

  return null;
}

/**
 * The standardisation of a name plus its match, in one call.
 *
 * stockRunout needs both — the class decides whether an item is forecastable at
 * all, the match decides its share — and calling standardize() twice would let
 * the two drift if the precedence rules ever changed.
 */
export function classifyResource(resourceName) {
  const standardized = standardize(resourceName);
  return { standardized, match: shareFor(resourceName) };
}
