import { getPool } from '../../config/database.js';

/**
 * Distribution repository — queries the distributions table
 * joined with devices to get camp_id.
 */
export async function getDistributions({ campId, resourceType, startDate, endDate, search, page = 0, limit = 20 } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];
  let idx = 1;

  if (campId) {
    conditions.push(`d.device_id IN (SELECT device_id FROM devices WHERE camp_id = $${idx++})`);
    params.push(campId);
  }
  if (resourceType) {
    conditions.push(`d.resource_type = $${idx++}`);
    params.push(resourceType);
  }
  if (startDate) {
    conditions.push(`d.distributed_at >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`d.distributed_at <= $${idx++}`);
    params.push(endDate);
  }
  if (search) {
    conditions.push(`(d.wristband_barcode ILIKE $${idx} OR d.device_id ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM distributions d ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = page * limit;
  const dataResult = await pool.query(
    `SELECT d.id, d.wristband_barcode, d.resource_type, d.quantity, d.distributed_at, d.device_id,
            dev.camp_id
     FROM distributions d
     LEFT JOIN devices dev ON d.device_id = dev.device_id
     ${where}
     ORDER BY d.distributed_at DESC NULLS LAST
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { data: dataResult.rows, total, page, limit };
}

export async function getDistributionSummary(campId) {
  const pool = getPool();
  const conditions = [];
  const params = [];
  let idx = 1;

  if (campId) {
    conditions.push(`d.device_id IN (SELECT device_id FROM devices WHERE camp_id = $${idx++})`);
    params.push(campId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT
       COUNT(*) as total_records,
       COALESCE(SUM(d.quantity), 0) as total_quantity,
       COUNT(DISTINCT d.wristband_barcode) as unique_recipients,
       COUNT(DISTINCT d.device_id) as active_devices,
       COUNT(DISTINCT d.resource_type) as resource_types
     FROM distributions d
     ${where}`,
    params
  );

  return result.rows[0];
}

export async function getDistributionByResourceType(campId) {
  const pool = getPool();
  const conditions = [];
  const params = [];
  let idx = 1;

  if (campId) {
    conditions.push(`d.device_id IN (SELECT device_id FROM devices WHERE camp_id = $${idx++})`);
    params.push(campId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT d.resource_type, COUNT(*) as count, SUM(d.quantity) as total_quantity
     FROM distributions d
     ${where}
     GROUP BY d.resource_type
     ORDER BY total_quantity DESC`,
    params
  );

  return result.rows;
}

export async function getDistributionTimeline(campId, days = 30) {
  const pool = getPool();
  const conditions = [`d.distributed_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'`];
  const params = [];
  let idx = 1;

  if (campId) {
    conditions.push(`d.device_id IN (SELECT device_id FROM devices WHERE camp_id = $${idx++})`);
    params.push(campId);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const result = await pool.query(
    `SELECT
       TO_CHAR(DATE(d.distributed_at), 'YYYY-MM-DD') as date,
       d.resource_type,
       COUNT(*) as count,
       SUM(d.quantity) as total_quantity
     FROM distributions d
     ${where}
     GROUP BY DATE(d.distributed_at), d.resource_type
     ORDER BY date ASC`,
    params
  );

  return result.rows;
}

export async function getCampList() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT DISTINCT camp_id FROM devices WHERE camp_id IS NOT NULL ORDER BY camp_id`
  );
  return result.rows.map((r) => r.camp_id);
}

export async function getResourceTypes() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT DISTINCT resource_type FROM distributions WHERE resource_type IS NOT NULL ORDER BY resource_type`
  );
  return result.rows.map((r) => r.resource_type);
}
