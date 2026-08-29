/**
 * Disaster domain controllers — HTTP layer only.
 */
import {
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
  getDisasterOperationalData,
} from '../../data/disaster/camp.repository.js';
import { predictFloodForCamp } from '../../services/disaster/floodPrediction.service.js';
import { getWaterLevelHistoryForCamp } from '../../services/disaster/waterLevelHistory.service.js';
import { listDisasterAlerts, updateDisasterAlertStatus } from '../../data/disaster/alert.repository.js';
import { aggregateCampImmediate, aggregateAllCamps, getAggregationStatus } from '../../services/disaster/campsAggregation.service.js';
import { env } from '../../config/env.js';
import { mqttService } from '../../services/network/mqtt.service.js';
import { getPool } from '../../config/database.js';

export async function getOverview(_req, res, next) {
  try {
    const overview = await getDisasterDashboardSummary();
    const alerts = await listDisasterAlerts({ status: 'ACTIVE' });
    res.json({ ...overview, alerts, alert_summary: { critical: alerts.filter((alert) => alert.severity === 'CRITICAL').length, high: alerts.filter((alert) => alert.severity === 'HIGH').length } });
  } catch (err) {
    next(err);
  }
}

export async function getCamps(_req, res, next) {
  try {
    res.json({ camps: await getDisasterCampSummaries() });
  } catch (err) {
    next(err);
  }
}

export async function getMapNodes(_req, res, next) {
  try {
    res.json({ nodes: await getDisasterMapNodes() });
  } catch (err) {
    next(err);
  }
}

export async function getCampById(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({
      error: 'Camp not found',
      campId: req.params.campId,
    });
  }

  try {
    const operational = await getDisasterOperationalData(camp.id);
    const detail = {
      ...camp.detail,
      ...(operational.hydrospatial ? {
        elev: operational.hydrospatial.elevation ?? camp.detail?.elev,
        river: operational.hydrospatial.river_name ?? camp.detail?.river,
        station: operational.hydrospatial.station_name ?? camp.detail?.station,
        stDist: operational.hydrospatial.gauge_distance ?? camp.detail?.stDist,
      } : {}),
      ...(operational.water_level ? { wl: operational.water_level.water_level } : {}),
    };
    if (operational.prediction || operational.alerts.length) {
      return res.json({ ...camp, detail, prediction: operational.prediction, operational });
    }
    if (env.db.enabled) return res.json({ ...camp, detail, prediction: null, operational });
    const prediction = predictFloodForCamp(camp);
    return res.json({ ...camp, prediction });
  } catch (error) {
    return res.json({
      ...camp,
      prediction: null,
      prediction_error: error instanceof Error ? error.message : 'Failed to run flood prediction',
    });
  }
}

export async function predictCamp(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({ error: 'Camp not found', campId: req.params.campId });
  }

  try {
    const result = predictFloodForCamp(camp);
    return res.json({ prediction: result });
  } catch (err) {
    console.error('[FloodPrediction] Error for', req.params.campId, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

export async function getCampWaterLevelHistory(req, res, next) {
  let camp;
  try {
    camp = await getDisasterCampById(req.params.campId);
  } catch (err) {
    return next(err);
  }

  if (!camp) {
    return res.status(404).json({ error: 'Camp not found', campId: req.params.campId });
  }

  try {
    const hours = Number(req.query.hours || 8);
    const history = await getWaterLevelHistoryForCamp(camp, { hours });

    history.points.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json({
      camp_id: camp.id,
      station: history.station,
      source: history.source,
      points: history.points,
    });
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to load water-level history',
      campId: req.params.campId,
    });
  }
}

export async function getDisasterAlerts(req, res, next) {
  try {
    res.json({ alerts: await listDisasterAlerts({ campId: req.query.camp, status: req.query.status }) });
  } catch (err) {
    next(err);
  }
}

export async function updateAlertStatus(req, res, next) {
  const status = String(req.body?.status || '').toUpperCase();
  if (!['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status)) return res.status(400).json({ error: 'Invalid alert status' });
  try {
    const alert = await updateDisasterAlertStatus(req.params.alertId, status);
    if (!alert) return res.status(404).json({ error: 'Disaster alert not found' });
    res.json({ alert });
  } catch (err) {
    next(err);
  }
}

// ── Aggregation endpoints ────────────────────────────────────────────

export async function getAggregationOverview(_req, res, next) {
  try {
    res.json(getAggregationStatus());
  } catch (err) {
    next(err);
  }
}

export async function triggerCampAggregation(req, res, next) {
  try {
    const result = await aggregateCampImmediate(req.params.campId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function triggerAllCampAggregations(_req, res, next) {
  try {
    const result = await aggregateAllCamps();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

const VALID_CAMPS_STATUSES = ['stable', 'medium', 'high', 'critical', 'recovery'];

export async function updateCampStatus(req, res, next) {
  const { campId } = req.params;
  const { status } = req.body;

  if (!VALID_CAMPS_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_CAMPS_STATUSES.join(', ')}` });
  }

  try {
    if (env.db.enabled) {
      const pool = getPool();
      await pool.query(
        `UPDATE "CAMPS" SET status = $1, updated_at = NOW() WHERE id = $2`,
        [status, campId]
      );
    }

    // Publish status change to RPi via MQTT
    mqttService.publish(`smartcamp/camps/${campId}/status`, {
      camp_id: campId,
      status,
      updated_at: new Date().toISOString(),
      source: 'cloud_admin',
    });

    console.log(`[Camp] Status updated: ${campId} → ${status}`);
    res.json({ campId, status, updated_at: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
}