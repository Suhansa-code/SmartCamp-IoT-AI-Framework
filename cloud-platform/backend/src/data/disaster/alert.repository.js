import { getPool } from '../../config/database.js';

export async function listDisasterAlerts({ campId, status } = {}) {
  const conditions = [];
  const values = [];
  if (campId) { values.push(campId); conditions.push(`camp_id = $${values.length}`); }
  if (status) { values.push(status.toUpperCase()); conditions.push(`status = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await getPool().query(`SELECT * FROM disaster_alerts ${where} ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, created_at DESC`, values);
  return result.rows;
}

export async function updateDisasterAlertStatus(alertId, status) {
  const result = await getPool().query(
    `UPDATE disaster_alerts SET status = $1, acknowledged_at = CASE WHEN $1 = 'ACKNOWLEDGED' THEN COALESCE(acknowledged_at, NOW()) ELSE acknowledged_at END WHERE alert_id = $2 OR event_id = $2 RETURNING *`,
    [status.toUpperCase(), alertId],
  );
  return result.rows[0] || null;
}