/**
 * Stock runout endpoints — "when does rice run out, and when must we order?"
 *
 * Population history and the live roster come from campData.service (mirrored
 * from the Pi over MQTT); stock levels come from the resources table.
 */
import { computeStockOutlook } from '../../services/resources/stockRunout.service.js';
import { getPersons, getPopulationHistory, getOverview } from '../../services/resources/campData.service.js';
import { getResourceInventory } from '../../services/resource/resource.service.js';
import { env } from '../../config/env.js';

async function buildOutlook(query = {}) {
  const [history, inventory] = await Promise.all([
    getPopulationHistory(),
    getResourceInventory({ page: 0, limit: 500 }),
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
