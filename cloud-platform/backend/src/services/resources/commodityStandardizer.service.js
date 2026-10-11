/**
 * CommodityStandardizer — turn a free-text camp store line into a canonical
 * name and a class, BEFORE anything tries to match it to a survey commodity.
 *
 * ── Why this step exists ────────────────────────────────────────────────────
 *
 * `resources.resource_name` is a free-text column typed by a store keeper under
 * pressure. The survey commodity names it has to be matched against come from a
 * statistical codebook. The two vocabularies do not meet:
 *
 *     store writes          survey says                       old result
 *     ─────────────────     ────────────────────────────      ──────────
 *     Milk Powder           Powdered milk                     no match
 *     Potatoes              White or yellow fleshed potato     no match
 *     Cooking Oil           Coconut oil                        no match
 *     Dried Sprats          Dried small fish (e.g., sprats…)   no match
 *     Rice 5kg              White rice                         no match
 *     Ice                   White rice                         MATCHED (!)
 *
 * The last row is the one that matters. Matching used to be raw substring
 * containment in either direction, so "ice" is inside "white r-ice" and an
 * ice item was silently assigned 23.5 % of the entire camp food basket. Nothing
 * in the response said so; it looked like a confident match.
 *
 * The failures above are not all the same kind of problem, and lumping them
 * into one fuzzy comparison is why they were invisible. They separate cleanly:
 *
 *   mechanical  case, accents, punctuation, parentheticals, pack sizes,
 *               plurals, word order          -> normalisation, no knowledge needed
 *   vocabulary  "cooking oil" IS "coconut oil" here, "parippu" IS "dhal"
 *                                            -> a curated alias table
 *   class       tea is deliberately NOT in the basket; a tarpaulin is not food
 *                                            -> explicit lists, not silence
 *
 * This module does the first and reads the second and third from
 * models/lka_v2/commodity_aliases.json. It deliberately knows nothing about
 * shares or kilograms: it decides WHICH commodity a line refers to, never HOW
 * MUCH of it is consumed. Every quantity stays in a measured artifact.
 *
 * ── Why the class lists matter as much as the aliases ───────────────────────
 *
 * commodity_shares.json excludes beverages by construction, because drinking
 * water is provisioned separately and counting tea as food would double-count
 * it. Before this module, a "Tea" line simply failed to match and was handed an
 * even slice of the *unallocated remainder* — the exact double count the
 * exclusion was designed to prevent. Naming beverages explicitly is what turns
 * that from a silent fabrication into a stated exclusion.
 *
 * The canonical key here is mirrored by canonical() in
 * prediction-models/scripts/validate_commodity_aliases.py. The two must stay in
 * step; that script fails the build if the alias table drifts from the shares
 * table, but it cannot detect the two implementations disagreeing, so change
 * both together.
 */
import fs from 'fs';
import { env } from '../../config/env.js';

/** What a store line turned out to be. Drives whether it is forecastable. */
export const CLASS = {
  FOOD: 'food',            // in the basket; a share can be assigned
  WATER: 'water',          // priced from the ration table, not the basket
  BEVERAGE: 'beverage',    // excluded from the basket on purpose
  NON_FOOD: 'non_food',    // not consumed at a daily per-person rate
  UNKNOWN: 'unknown',      // nothing in the table recognises it
};

let cache = null;

function load() {
  const path = env.resources.commodityAliasesPath;
  let raw;
  try {
    raw = fs.readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `Commodity alias table not found at ${path}. ` +
        'It is a checked-in artifact — restore it from git, or set COMMODITY_ALIASES_PATH. ' +
        `(${err.code})`,
    );
  }
  const table = JSON.parse(raw);
  for (const field of ['aliases', 'noise_tokens', 'token_stems']) {
    if (!table[field]) throw new Error(`Alias table at ${path} has no ${field}`);
  }

  const noise = new Set(table.noise_tokens);
  const stems = table.token_stems;

  // Canonicalise every list once at load, so lookups are O(1) per name and the
  // table can stay written in the vocabulary a human reads.
  const index = (names) => {
    const byKey = new Map();
    const singleTokens = new Set();
    for (const name of names || []) {
      const key = canonicalise(name, noise, stems);
      if (!key) continue;
      byKey.set(key, name);
      if (!key.includes(' ')) singleTokens.add(key);
    }
    return { byKey, singleTokens };
  };

  const aliases = new Map();
  for (const [name, targets] of Object.entries(table.aliases)) {
    const key = canonicalise(name, noise, stems);
    if (key) aliases.set(key, { alias: name, targets });
  }

  console.log(
    `[Standardizer] ${aliases.size} aliases, ${table.non_food?.length ?? 0} non-food, ` +
      `${table.beverage_excluded?.length ?? 0} excluded beverages loaded ` +
      `(${table.artifact_id} v${table.schema_version})`,
  );

  return {
    meta: table,
    noise,
    stems,
    aliases,
    water: index(table.water),
    nonFood: index(table.non_food),
    beverage: index(table.beverage_excluded),
  };
}

export function getAliasTable() {
  if (!cache) cache = load();
  return cache;
}

/** Drop the cache so the next call re-reads the artifact from disk. */
export function reloadAliasTable() {
  cache = null;
  return getAliasTable();
}

// ── normalisation ──────────────────────────────────────────────────────────

// A pure quantity token, with or without a unit stuck to it: 5, 5kg, 400g, 20l.
const QUANTITY = /^\d+(\.\d+)?(kg|g|l|ml|lb|oz)?$/;

/**
 * Conservative English plural stripping.
 *
 * The guarantee here is SYMMETRY, not linguistic correctness. Both the store
 * name and the survey commodity name go through this same function, so a rule
 * that mangles a word mangles it identically on both sides and the two still
 * meet: "Molasses" reduces to "molass" whichever column it came from. What
 * would break matching is a rule that fires on one side and not the other —
 * which is why nothing here is conditional on where the name came from.
 *
 * Still conservative, because a mangled key is a worse diagnostic when a match
 * fails: "-us" and "-is" endings are left alone so "hummus" survives, and words
 * of three letters or fewer are untouched entirely — stripping the s from "gas"
 * produces a token that means nothing to a human reading the API response.
 */
function singularise(token) {
  if (token.length <= 3) return token;
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  // potatoes -> potato, tomatoes -> tomato, mangoes -> mango. Length-gated so
  // short -oes words keep the plain rule: "shoes" -> "shoe", not "sho".
  if (token.length >= 6 && token.endsWith('oes')) return token.slice(0, -2);
  if (/(ses|xes|zes|ches|shes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('s') && !/(ss|us|is)$/.test(token)) return token.slice(0, -1);
  return token;
}

/**
 * The canonical key: a sorted, de-noised, singularised token string.
 *
 * Sorting the tokens is what makes word order irrelevant, so "Milk Powder" and
 * "Powdered milk" produce the same key without either being listed as an alias
 * of the other. Combined with the `powdered -> powder` stem, that one rule
 * removes a whole class of alias entries that would otherwise be hand-written
 * and would rot.
 *
 * Steps, in this fixed order:
 *   lowercase -> strip accents -> drop parentheticals -> & to "and" ->
 *   punctuation to space -> drop quantities and noise tokens -> singularise ->
 *   apply stems -> drop noise again -> sort
 *
 * Parentheticals go before punctuation so "Dhal (Red Lentils)" loses the whole
 * qualifier rather than merging it into the name. Noise is checked twice
 * because stemming can turn a token into one ("veggies" -> "vegetable").
 */
function canonicalise(name, noise, stems) {
  const cleaned = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/\([^)]*\)/g, ' ')        // drop parentheticals
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')      // punctuation -> space
    .trim();

  const tokens = [];
  for (const rawToken of cleaned.split(/\s+/)) {
    if (!rawToken || QUANTITY.test(rawToken) || noise.has(rawToken)) continue;
    let token = singularise(rawToken);
    token = stems[token] ?? token;
    if (noise.has(token)) continue;
    tokens.push(token);
  }
  return tokens.sort().join(' ');
}

/** Canonical key for a name, using the loaded alias table's noise and stems. */
export function canonicalKey(name) {
  const t = getAliasTable();
  return canonicalise(name, t.noise, t.stems);
}

/** Canonical key as a token array, for subset/superset comparison. */
export function canonicalTokens(name) {
  const key = canonicalKey(name);
  return key ? key.split(' ') : [];
}

// ── the standardisation step ───────────────────────────────────────────────

/**
 * Standardise one store line.
 *
 * Class precedence is water -> non-food -> beverage -> alias, and it is
 * deliberate. Water is decided first because it is the one class priced from a
 * different artifact entirely, so a mistake there is a unit error, not a share
 * error. Non-food comes before the alias table so that a name appearing in both
 * (which the validator forbids, but which a hand edit could introduce) fails
 * closed — refusing to forecast — rather than open, inventing a runout date for
 * a tarpaulin.
 *
 * A name that matches no list is UNKNOWN, not "food". Guessing food here is
 * what would let a mis-typed medical item draw down the ration basket. The
 * caller decides what to do with UNKNOWN, and the shares table still gets a
 * chance at it — an unlisted but genuine commodity like "Cabbage" matches
 * exactly downstream without needing an alias.
 *
 * @param {string} rawName  the resource_name column, verbatim
 * @returns {{
 *   raw: string, canonical: string, tokens: string[],
 *   klass: string, targets: string[]|null, rule: string, note: string|null
 * }}
 */
export function standardize(rawName) {
  const t = getAliasTable();
  const canonical = canonicalise(rawName, t.noise, t.stems);
  const tokens = canonical ? canonical.split(' ') : [];

  const base = { raw: String(rawName ?? ''), canonical, tokens };

  if (!canonical) {
    return { ...base, klass: CLASS.UNKNOWN, targets: null, rule: 'empty',
             note: 'Name is empty once pack sizes and punctuation are removed.' };
  }

  // Whole-name hits first, then any single token that is itself a list entry,
  // so "Tarpaulin Sheet" and "Water Bowser Load" still classify.
  const inList = (list) =>
    list.byKey.get(canonical) ?? tokens.find((tok) => list.singleTokens.has(tok)) ?? null;

  const water = inList(t.water);
  if (water) {
    return { ...base, klass: CLASS.WATER, targets: null, rule: 'alias_list:water',
             note: 'Priced from the drinking-water rate in ration_rates.json, not from the food basket.' };
  }

  const nonFood = inList(t.nonFood);
  if (nonFood) {
    return { ...base, klass: CLASS.NON_FOOD, targets: null, rule: 'alias_list:non_food',
             note: 'Listed as a non-consumable, so no daily draw-down rate applies.' };
  }

  const beverage = inList(t.beverage);
  if (beverage) {
    return { ...base, klass: CLASS.BEVERAGE, targets: null, rule: 'alias_list:beverage_excluded',
             note: 'Beverages are excluded from the food basket by construction, because drinking ' +
                   'water is provisioned separately. Giving this item a food share would double-count it.' };
  }

  const alias = t.aliases.get(canonical);
  if (alias) {
    return {
      ...base,
      klass: CLASS.FOOD,
      targets: alias.targets,
      rule: 'alias',
      note: alias.targets.length > 1
        ? `"${alias.alias}" covers ${alias.targets.length} survey commodities; their shares are summed.`
        : null,
    };
  }

  return { ...base, klass: CLASS.UNKNOWN, targets: null, rule: 'unrecognised', note: null };
}

/** Provenance for the API and the UI, so the alias step is auditable. */
export function getAliasProvenance() {
  const t = getAliasTable();
  const m = t.meta;
  return {
    schema_version: m.schema_version,
    artifact_id: m.artifact_id,
    generated_at: m.generated_at,
    generated_by: m.generated_by,
    basis: m.basis,
    evidence: m.evidence,
    evidence_note: m.evidence_note,
    caveat: m.caveat,
    counts: {
      aliases: t.aliases.size,
      non_food: m.non_food?.length ?? 0,
      water: m.water?.length ?? 0,
      beverage_excluded: m.beverage_excluded?.length ?? 0,
      noise_tokens: m.noise_tokens.length,
      token_stems: Object.keys(m.token_stems).length,
    },
  };
}
