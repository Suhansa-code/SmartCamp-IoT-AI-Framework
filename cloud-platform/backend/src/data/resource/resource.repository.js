import { getPool } from '../../config/database.js';

/**
 * Resource inventory — queries the resources table.
 */
export async function getResourceInventory({ category, status, search, page = 0, limit = 20 } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];
  let idx = 1;

  if (category) {
    conditions.push(`r.category = $${idx++}`);
    params.push(category);
  }
  if (status) {
    conditions.push(`r.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(r.resource_name ILIKE $${idx} OR r.category ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(`SELECT COUNT(*) FROM resources r ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  const offset = page * limit;
  const dataResult = await pool.query(
    `SELECT r.id, r.resource_name, r.category, r.unit,
            r.total_quantity, r.available_quantity, r.minimum_threshold,
            r.status, r.created_at, r.updated_at
     FROM resources r
     ${where}
     ORDER BY r.resource_name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  return { data: dataResult.rows, total, page, limit };
}

/**
 * Resource summary — aggregate stats across all resources.
 */
export async function getResourceSummary() {
  const pool = getPool();

  const totalsResult = await pool.query(
    `SELECT
       COUNT(*) as total_resources,
       COALESCE(SUM(r.total_quantity), 0) as total_quantity,
       COALESCE(SUM(r.available_quantity), 0) as available_quantity,
       COUNT(*) FILTER (WHERE r.available_quantity <= r.minimum_threshold) as below_threshold,
       COUNT(*) FILTER (WHERE r.status = 'AVAILABLE') as available_count,
       COUNT(*) FILTER (WHERE r.status = 'LOW') as low_count,
       COUNT(*) FILTER (WHERE r.status = 'CRITICAL') as critical_count,
       COUNT(*) FILTER (WHERE r.status = 'UNAVAILABLE') as unavailable_count
     FROM resources r`
  );

  const byCategoryResult = await pool.query(
    `SELECT r.category,
            COUNT(*) as count,
            COALESCE(SUM(r.total_quantity), 0) as total_quantity,
            COALESCE(SUM(r.available_quantity), 0) as available_quantity
     FROM resources r
     WHERE r.category IS NOT NULL
     GROUP BY r.category
     ORDER BY count DESC`
  );

  return {
    ...totalsResult.rows[0],
    by_category: byCategoryResult.rows,
  };
}

/**
 * Resource usage timeline — daily usage aggregated from resource_usage + distributions.
 */
export async function getResourceUsageTimeline(days = 30) {
  const pool = getPool();

  const usageResult = await pool.query(
    `SELECT DATE(u.created_at) as date,
            r.category,
            SUM(u.quantity) as total_used
     FROM resource_usage u
     JOIN resources r ON u.resource_id = r.id
     WHERE u.created_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
     GROUP BY DATE(u.created_at), r.category
     ORDER BY date ASC`
  );

  const distResult = await pool.query(
    `SELECT DATE(d.distributed_at) as date,
            d.resource_type as category,
            SUM(d.quantity) as total_used
     FROM distributions d
     WHERE d.distributed_at >= NOW() - INTERVAL '${parseInt(days, 10)} days'
     GROUP BY DATE(d.distributed_at), d.resource_type
     ORDER BY date ASC`
  );

  // Merge both sources by date+category
  const merged = {};
  for (const row of [...usageResult.rows, ...distResult.rows]) {
    const key = `${row.date}|${row.category}`;
    if (!merged[key]) merged[key] = { date: row.date, category: row.category, total_used: 0 };
    merged[key].total_used += parseFloat(row.total_used) || 0;
  }

  return Object.values(merged).sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return (a.category || '').localeCompare(b.category || '');
  });
}

/**
 * Recent flood predictions — latest entries from flood_predictions table.
 */
export async function getFloodPredictions(limit = 20) {
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, prediction_id, latitude, longitude, rainfall, elevation,
            river_distance, flood_probability, flood_category,
            forecast_hours, model_version, predicted_at
     FROM flood_predictions
     ORDER BY predicted_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows;
}

/**
 * Resource categories — distinct category values.
 */
export async function getResourceCategories() {
  const pool = getPool();
  const result = await pool.query(
    `SELECT DISTINCT category FROM resources WHERE category IS NOT NULL ORDER BY category`
  );
  return result.rows.map((r) => r.category);
}
