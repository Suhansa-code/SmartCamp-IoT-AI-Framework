import crypto from 'crypto';
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import * as saamp from '../network/saamp-mqtt.js';
import { getCampById } from './disaster.js';

const ALERTABLE_RISKS = new Set(['HIGH', 'CRITICAL']);
const SEVERITY_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRisk(value) {
  const risk = String(value || '').toUpperCase();
  return risk === 'SEVERE' || risk === 'EXTREME' ? 'CRITICAL' : risk;
}

function buildAlert({ prediction, inputs, hydrospatial, predictionId, predictionTimestamp }) {
  const risk = normalizeRisk(prediction.risk_category);
  const camp = getCampById(C.CAMP_ID) || {};
  const campName = camp.name || C.CAMP_ID;
  const probability = numberOrNull(prediction.flood_probability);
  const probabilityPercent = numberOrNull(prediction.flood_probability_percent ?? (probability == null ? null : probability * 100));
  const title = `${risk} FLOOD RISK - ${campName}`;
  const message = [
    probabilityPercent == null ? null : `Flood probability at ${campName} has reached ${Math.round(probabilityPercent)}%.`,
    inputs.river_distance_km == null ? null : `The camp is approximately ${inputs.river_distance_km} km from the nearest river.`,
    inputs.water_level_m == null ? null : `The current gauging-station water level is ${inputs.water_level_m} m.`,
    risk === 'CRITICAL' ? 'Urgent authority attention is required.' : 'Immediate monitoring is recommended.',
  ].filter(Boolean).join(' ');
  return {
    alert_id: crypto.randomUUID(), event_id: crypto.randomUUID(), camp_id: C.CAMP_ID, camp_name: campName,
    alert_type: `FLOOD_RISK_${risk}`, severity: risk, priority: 'HIGH', status: 'ACTIVE', title, message,
    latitude: inputs.latitude, longitude: inputs.longitude, camp_latitude: inputs.latitude, camp_longitude: inputs.longitude,
    prediction_id: predictionId, flood_probability: probability, flood_probability_percent: probabilityPercent,
    risk_category: risk, forecast_hours: prediction.forecast_hours ?? null, rainfall: inputs.rainfall_mm,
    camp_elevation: inputs.elevation_m, river_distance_km: inputs.river_distance_km, water_level: inputs.water_level_m,
    station_id: hydrospatial?.station_id ?? null, station_name: hydrospatial?.station_name ?? null,
    gauge_elevation: hydrospatial?.gauge_elevation ?? null, elevation_difference: hydrospatial?.elevation_difference ?? null,
    gauge_distance_km: hydrospatial?.gauge_distance_km ?? null, gauge_latitude: hydrospatial?.gauge_latitude ?? null,
    gauge_longitude: hydrospatial?.gauge_longitude ?? null, river_name: hydrospatial?.river_name ?? null,
    source: 'raspberry_pi', prediction_timestamp: predictionTimestamp, schema_version: '1.0',
    mqtt_status: 'PENDING', cloud_sync_status: 'PENDING',
  };
}

function persistAlert(alert) {
  const columns = Object.keys(alert);
  const placeholders = columns.map(() => '?').join(', ');
  const updates = columns.filter((column) => !['alert_id', 'event_id'].includes(column)).map((column) => `${column} = excluded.${column}`).join(', ');
  return disasterDb.prepare(`INSERT INTO disaster_alerts (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(event_id) DO UPDATE SET ${updates}`).run(...columns.map((column) => alert[column]));
}

export function evaluateFloodPrediction({ prediction, inputs, hydrospatial, predictionId, predictionTimestamp = new Date().toISOString() }) {
  const risk = normalizeRisk(prediction?.risk_category);
  if (!ALERTABLE_RISKS.has(risk)) return { created: false, reason: 'risk_not_alertable', risk_category: risk };

  const active = disasterDb.prepare(`SELECT * FROM disaster_alerts WHERE camp_id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED') ORDER BY id DESC`).all(C.CAMP_ID);
  const higherOrEquivalent = active.find((alert) => (SEVERITY_RANK[normalizeRisk(alert.severity)] ?? -1) >= SEVERITY_RANK[risk]);
  if (higherOrEquivalent) {
    disasterDb.prepare(`UPDATE disaster_alerts SET cloud_sync_status = 'PENDING', synced = 0 WHERE id = ?`).run(higherOrEquivalent.id);
    return { created: false, refreshed: true, alert: higherOrEquivalent };
  }

  const alert = buildAlert({ prediction: { ...prediction, risk_category: risk }, inputs, hydrospatial, predictionId, predictionTimestamp });
  persistAlert(alert);
  const saved = disasterDb.prepare('SELECT * FROM disaster_alerts WHERE event_id = ?').get(alert.event_id);
  const compact = { id: saved.id, event_id: saved.event_id, alert_id: saved.alert_id, camp_id: saved.camp_id, camp_name: saved.camp_name, alert_type: saved.alert_type, severity: saved.severity, priority: saved.priority, title: saved.title, flood_probability: saved.flood_probability, risk_category: saved.risk_category, created_at: saved.created_at, source: saved.source };
  const result = saamp.publish(`smartcamp/alerts/${saved.camp_id}`, compact, 'alert', 'disaster-alert');
  disasterDb.prepare('UPDATE disaster_alerts SET mqtt_status = ? WHERE id = ?').run(result.published ? 'PUBLISHED' : 'PENDING', saved.id);
  return { created: true, alert: disasterDb.prepare('SELECT * FROM disaster_alerts WHERE id = ?').get(saved.id), mqtt: result };
}
