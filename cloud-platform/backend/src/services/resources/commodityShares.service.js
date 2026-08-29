/**
 * CommodityShares — per-item share of the daily food basket.
 *
 * Built by prediction-models/scripts/build_commodity_shares.py from the BRIGHT
 * Sri Lanka household survey (mod_j1_fah_long, 131 items, 7-day recall), with
 * beverages excluded so they are not counted twice against the separate
 * drinking-water allowance.
 *
 * This is what turns one food_kg_day figure into "rice runs out Wednesday,
 * dhal holds until Sunday". Stock is held per commodity; demand is not, so the
 * basket shares are the bridge between them.
 *
 * Matching is deliberately forgiving: a camp store writes "Rice" where the
 * survey says "White rice". Anything that cannot be matched falls back to an
 * even split of whatever share is left unallocated, and reports that it did.
 */
import fs from 'fs';
import { env } from '../../config/env.js';

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
  return getShares();
}

/** Normalise a name for fuzzy matching: lowercase, strip parentheticals/punctuation. */
function key(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Match a camp store resource name to a survey commodity share.
 *
 * Exact normalised match first, then containment either way ("rice" matches
 * "white rice"; "red rice 5kg" matches "red rice"). Returns null when nothing
 * matches, so the caller can apply the unallocated remainder instead of
 * silently assigning a wrong share.
 */
export function shareFor(resourceName) {
  const shares = getShares().shares;
  const k = key(resourceName);
  if (!k) return null;

  for (const [name, value] of Object.entries(shares)) {
    if (key(name) === k) return { commodity: name, share: value, match: 'exact' };
  }
  // Prefer the largest share among partial matches — "rice" should land on
  // white rice (18.2 %) rather than a 0.2 % rice product.
  let best = null;
  for (const [name, value] of Object.entries(shares)) {
    const nk = key(name);
    if ((nk.includes(k) || k.includes(nk)) && (!best || value > best.share)) {
      best = { commodity: name, share: value, match: 'partial' };
    }
  }
  return best;
}
