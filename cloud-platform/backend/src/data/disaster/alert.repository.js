import { getPool } from '../../config/database.js';
import { env } from '../../config/env.js';

const CACHE_TTL_MS = 10_000;
const cache = new Map();

export async function listDisasterAlerts({ campId, status } = {}) {
  if (!env.db.enabled) return [];
  const cacheKey = JSON.stringify({ campId: campId || null, status: status || null });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const conditions = [];
  const values = [];
  if (campId) { values.push(campId); conditions.push(`camp_id = $${values.length}`); }
  if (status) { values.push(status.toUpperCase()); conditions.push(`status = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await getPool().query(`SELECT * FROM disaster_alerts ${where} ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, created_at DESC`, values);
  cache.set(cacheKey, { value: result.rows, expiresAt: Date.now() + CACHE_TTL_MS });
  return result.rows;
}

export async function updateDisasterAlertStatus(alertId, status) {
  if (!env.db.enabled) return null;
  const result = await getPool().query(
    `UPDATE disaster_alerts SET status = $1, acknowledged_at = CASE WHEN $1 = 'ACKNOWLEDGED' THEN COALESCE(acknowledged_at, NOW()) ELSE acknowledged_at END WHERE alert_id = $2 OR event_id = $2 RETURNING *`,
    [status.toUpperCase(), alertId],
  );
  cache.clear();
  return result.rows[0] || null;
}