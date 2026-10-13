/**
 * Stock runout endpoints — "when does rice run out, and when must we order?"
 *
 * Population history and the live roster come from campData.service (mirrored
 * from the Pi over MQTT); stock levels come from the resources table.
 */
import { computeStockOutlook } from '../../services/resources/stockRunout.service.js';
import { standardize, getAliasProvenance, reloadAliasTable } from '../../services/resources/commodityStandardizer.service.js';
import { shareFor, reloadShares } from '../../services/resources/commodityShares.service.js';
import { getPersons, getPopulationHistory, getOverview } from '../../services/resources/campData.service.js';
import { listForecastItems } from '../../data/resources/inventory.repository.js';
import { getResourceInventory } from '../../services/resource/resource.service.js';
import { env } from '../../config/env.js';

async function loadInventory() {
  if (!env.db.enabled) return { data: [] };

  // New entries use the normalized Neon inventory table. Existing camps may
  // still only have their Pi-synced stock in `resources`, so retain it as a
  // read-only source until staff enter the first operational inventory item.
  const items = await listForecastItems();
  return items.length ? { data: items } : getResourceInventory({ page: 0, limit: 500 });
}

async function buildOutlook(query = {}) {
  const [history, inventory] = await Promise.all([
    getPopulationHistory(),
    loadInventory(),
  ]);

  const persons = getPersons();
  const overview = getOverview();
  const resources = inventory?.data ?? [];

  return computeStockOutlook({
    resources,
    history,
    currentPopulation: overview?.day?.total_persons ?? persons.length,
    persons,
    horizonDays: Math.min(90, Math.max(7, parseInt(query.days, 10) || 30)),
    leadTimeDays: Math.max(0, parseInt(query.lead_time, 10) || env.resources.resupplyLeadTimeDays),
  });
}

/** GET /api/resources/stock/outlook — every item with its runout date. */
export async function getStockOutlook(req, res) {
  try {
    res.json(await buildOutlook(req.query));
  } catch (err) {
    console.error('[StockRunout] getStockOutlook error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute stock outlook' });
  }
}

/** GET /api/resources/stock/alerts — only what needs action, most urgent first. */
export async function getStockAlerts(req, res) {
  try {
    const outlook = await buildOutlook(req.query);
    const actionable = outlook.items.filter(
      (i) => i.forecastable && (i.status === 'CRITICAL' || i.status === 'LOW'),
    );
    res.json({
      generated_at: outlook.generated_at,
      lead_time_days: outlook.lead_time_days,
      population: outlook.population.current,
      confidence: outlook.population.confidence,
      count: actionable.length,
      alerts: actionable.map((i) => ({
        resource_name: i.resource_name,
        status: i.status,
        days_cover: i.days_cover,
        runout_date: i.runout_date,
        reorder_by: i.reorder_by,
        suggested_order_qty: i.suggested_order_qty,
        unit: i.unit,
        message:
          `${i.resource_name}: ${i.days_cover} day(s) of cover — runs out ${i.runout_date}. ` +
          `Order ${i.suggested_order_qty} ${i.unit} by ${i.reorder_by}.`,
      })),
    });
  } catch (err) {
    console.error('[StockRunout] getStockAlerts error:', err);
    res.status(500).json({ error: err.message || 'Failed to compute stock alerts' });
  }
}


/**
 * GET /api/resources/stock/aliases — what the standardisation layer knows.
 *
 * The alias table is the one artifact in this pipeline that is curated rather
 * than measured, so it is the one most likely to be wrong and the one an
 * operator has the most business inspecting. Exposing it means "why did rice
 * get that share?" is answerable without shell access to the container.
 *
 * `?name=` dry-runs one name through the whole chain without touching stock,
 * which is how you check an alias edit before trusting a reorder date to it.
 */
export function getAliasInfo(req, res) {
  try {
    const provenance = getAliasProvenance();
    const name = req.query.name;
    if (!name) return res.json(provenance);

    const standardized = standardize(name);
    const match = shareFor(name);
    res.json({
      provenance,
      probe: {
        raw: name,
        canonical: standardized.canonical,
        classified_as: standardized.klass,
        class_rule: standardized.rule,
        note: standardized.note,
        match: match && {
          commodity: match.commodity,
          commodities: match.commodities,
          share: match.share,
          rule: match.match,
          confidence: match.confidence,
        },
        explanation: match
          ? `"${name}" standardises to "${standardized.canonical}" and matches ` +
            `${match.commodities.length} survey commodit${match.commodities.length === 1 ? 'y' : 'ies'} ` +
            `by ${match.match}, for ${(match.share * 100).toFixed(2)} % of the daily food basket.`
          : `"${name}" standardises to "${standardized.canonical}" and is classified ` +
            `${standardized.klass}, so it is not given a share of the food basket.`,
      },
    });
  } catch (err) {
    console.error('[StockRunout] getAliasInfo error:', err);
    res.status(500).json({ error: err.message || 'Failed to read the alias table' });
  }
}

/**
 * POST /api/resources/stock/aliases/reload — re-read the artifacts from disk.
 *
 * commodity_aliases.json is hand-edited, so requiring a container restart to
 * pick up a new alias makes the sensible fix (name the commodity properly) more
 * expensive than the bad one (leave it on the unallocated remainder). The
 * shares cache is dropped too, because the alias table indexes against it and a
 * stale index would silently keep matching the old names.
 */
export function reloadAliases(_req, res) {
  try {
    reloadAliasTable();
    reloadShares();
    res.json({ reloaded: true, ...getAliasProvenance() });
  } catch (err) {
    console.error('[StockRunout] reloadAliases error:', err);
    res.status(500).json({ error: err.message || 'Failed to reload the alias table' });
  }
}
