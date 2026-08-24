/**
 * Distribution domain controllers — HTTP layer only.
 *
 * Scope is food and drinking water. Shelter and medical staffing are not part
 * of this model and are not served by any endpoint here.
 */
import {
  buildPlan,
  dailyRequirement,
  cohortsFromPersons,
} from '../../services/resources/distributionPlan.service.js';
import { getPersons, getPopulationHistory } from '../../services/resources/campData.service.js';
import { getProvenance, reloadRates } from '../../services/resources/rationRates.service.js';
import { getModelInfo } from '../../services/resources/childIntakeModel.service.js';
import { DEFAULT_HORIZON } from '../../services/resources/populationForecast.service.js';

function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * GET /api/resources/distribution/today
 * Today's requirement, derived from the live camp roster.
 */
export function getTodayRequirement(_req, res, next) {
  try {
    const persons = getPersons();
    const cohorts = cohortsFromPersons(persons);

    // Pass the actual child records so the trained model prices them,
    // rather than applying the rate-table constant to a head count.
    const childRecords = persons.filter((p) => {
      const age = p?.age;
      return age !== null && age !== undefined && age !== '' && Number(age) <= 17;
    });

    const requirement = dailyRequirement({
      totalPopulation: cohorts.total,
      children: cohorts.children,
      elderly: cohorts.elderly,
      pregnant: cohorts.pregnant,
      elderly75plus: cohorts.elderly_75plus,
      childrenPeople: childRecords,
      province: process.env.CAMP_PROVINCE || null,
    });

    res.json({
      source: 'live_camp_roster',
      generated_at: new Date().toISOString(),
      cohorts,
      requirement,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/resources/distribution/plan?days=7
 * Seven-day plan from the live registration history.
 */
export async function getDistributionPlan(req, res, next) {
  try {
    const horizonDays = Math.min(30, Math.max(1, toInt(req.query.days, DEFAULT_HORIZON)));

    const persons = getPersons();
    const cohorts = cohortsFromPersons(persons);
    const history = await getPopulationHistory();

    const childRecords = persons.filter((p) => {
      const age = p?.age;
      return age !== null && age !== undefined && age !== '' && Number(age) <= 17;
    });

    const plan = buildPlan({
      history,
      horizonDays,
      currentPopulation: cohorts.total,
      childrenRatio: cohorts.children_ratio,
      elderlyRatio: cohorts.elderly_ratio,
      pregnant: cohorts.pregnant,
      elderly75plusRatio: cohorts.elderly_75plus_share,
      childrenPeople: childRecords,
      province: process.env.CAMP_PROVINCE || null,
    });

    // Today's requirement, with its cohort breakdown, so the dashboard can show
    // who the food is for without a second request.
    const requirement = dailyRequirement({
      totalPopulation: cohorts.total,
      children: cohorts.children,
      elderly: cohorts.elderly,
      elderly75plus: cohorts.elderly_75plus,
      pregnant: cohorts.pregnant,
      childrenPeople: childRecords,
      province: process.env.CAMP_PROVINCE || null,
    });

    res.json({
      source: 'live_camp_roster',
      generated_at: new Date().toISOString(),
      cohorts,
      history,
      requirement,
      plan,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/resources/distribution/simulate
 * What-if planning for a hypothetical camp. Body accepts either cohort counts
 * or ratios, and an optional history for the forecast.
 */
export function simulateDistribution(req, res, next) {
  try {
    const body = req.body ?? {};
    const totalPopulation = toInt(body.total_population, 0);

    if (totalPopulation < 0) {
      return res.status(400).json({ error: 'total_population must be zero or greater' });
    }

    const pregnant = toInt(body.pregnant, 0);
    const hasCounts = body.children !== undefined || body.elderly !== undefined;

    const requirement = dailyRequirement({
      totalPopulation,
      children: hasCounts ? toInt(body.children, 0) : null,
      elderly: hasCounts ? toInt(body.elderly, 0) : null,
      childrenRatio: toFloat(body.children_ratio, 0),
      elderlyRatio: toFloat(body.elderly_ratio, 0),
      pregnant,
    });

    const horizonDays = Math.min(30, Math.max(1, toInt(body.days, DEFAULT_HORIZON)));
    const ratioOf = (count) => (totalPopulation > 0 ? count / totalPopulation : 0);

    const plan = buildPlan({
      history: Array.isArray(body.history) ? body.history : [],
      horizonDays,
      currentPopulation: totalPopulation,
      childrenRatio: ratioOf(requirement.breakdown.children.count),
      elderlyRatio: ratioOf(requirement.breakdown.elderly.count),
      pregnant,
    });

    res.json({
      source: 'simulation',
      generated_at: new Date().toISOString(),
      requirement,
      plan,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/resources/distribution/rates
 * The rate table with provenance, so the UI can show which numbers are
 * measured and which are assumptions.
 */
export function getRateProvenance(_req, res, next) {
  try {
    res.json({ ...getProvenance(), child_intake_model: getModelInfo() });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/resources/distribution/rates/reload
 * Re-read the artifact after rebuilding it, without restarting the backend.
 */
export function reloadRateTable(_req, res, next) {
  try {
    reloadRates();
    res.json({ reloaded: true, ...getProvenance() });
  } catch (err) {
    next(err);
  }
}
