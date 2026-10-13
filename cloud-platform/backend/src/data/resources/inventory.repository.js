import { getPool } from '../../config/database.js';

function statusFor(available, minimum) {
  if (available <= 0) return 'UNAVAILABLE';
  if (minimum > 0 && available <= minimum * 0.5) return 'CRITICAL';
  if (minimum > 0 && available <= minimum) return 'LOW';
  return 'AVAILABLE';
}

function itemColumns(alias = 'i') {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}id, ${prefix}resource_name, ${prefix}category, ${prefix}recorded_unit,
    ${prefix}base_unit, ${prefix}available_base_quantity, ${prefix}minimum_base_quantity,
    ${prefix}status, ${prefix}notes, ${prefix}created_at, ${prefix}updated_at`;
}

export async function listItems({ category, status, search, page = 0, limit = 20 } = {}) {
  const pool = getPool();
  const conditions = [];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`i.category = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`i.status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`i.resource_name ILIKE $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [{ rows: countRows }, { rows }] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM resource_inventory_items i ${where}`, params),
    pool.query(
      `SELECT ${itemColumns()}
       FROM resource_inventory_items i ${where}
       ORDER BY i.resource_name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, page * limit],
    ),
  ]);

  return { data: rows, total: Number(countRows[0].count), page, limit };
}

export async function createItem({ resourceName, category, recordedUnit, baseUnit, available, recordedAvailable, minimum, notes, recordedBy }) {
  const pool = getPool();
  const client = await pool.connect();
  const status = statusFor(available, minimum);

  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO resource_inventory_items
        (resource_name, category, recorded_unit, base_unit, available_base_quantity, minimum_base_quantity, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${itemColumns('')}`,
      [resourceName, category, recordedUnit, baseUnit, available, minimum, status, notes || null],
    );
    if (available > 0) {
      await client.query(
        `INSERT INTO resource_inventory_movements
          (inventory_item_id, quantity_base_change, recorded_quantity_change, recorded_unit, movement_type, reason, recorded_by)
         VALUES ($1, $2, $3, $4, 'opening_balance', 'Initial inventory entry', $5)`,
        [rows[0].id, available, recordedAvailable, recordedUnit, recordedBy || null],
      );
    }
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function adjustItem(id, { quantityChange, recordedQuantityChange, recordedUnit, movementType, reason, recordedBy }) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const { rows: found } = await client.query(
      `SELECT ${itemColumns()} FROM resource_inventory_items i WHERE i.id = $1 FOR UPDATE`,
      [id],
    );
    if (!found.length) {
      const error = new Error('Inventory item not found');
      error.statusCode = 404;
      throw error;
    }

    const item = found[0];
    const available = Number(item.available_base_quantity) + quantityChange;
    if (available < 0) {
      const error = new Error('Adjustment would make inventory negative');
      error.statusCode = 400;
      throw error;
    }
    const status = statusFor(available, Number(item.minimum_base_quantity));
    const { rows } = await client.query(
      `UPDATE resource_inventory_items
       SET available_base_quantity = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING ${itemColumns('')}`,
      [id, available, status],
    );
    await client.query(
      `INSERT INTO resource_inventory_movements
        (inventory_item_id, quantity_base_change, recorded_quantity_change, recorded_unit, movement_type, reason, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, quantityChange, recordedQuantityChange, recordedUnit, movementType, reason || null, recordedBy || null],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getSummary() {
  const pool = getPool();
  const [{ rows: totals }, { rows: byCategory }] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS total_items,
              COUNT(*) FILTER (WHERE status = 'LOW') AS low_count,
              COUNT(*) FILTER (WHERE status IN ('CRITICAL', 'UNAVAILABLE')) AS critical_count
       FROM resource_inventory_items`,
    ),
    pool.query(
      `SELECT category, base_unit AS unit, COUNT(*) AS count,
              COALESCE(SUM(available_base_quantity), 0) AS available_quantity,
              COALESCE(SUM(minimum_base_quantity), 0) AS minimum_quantity
       FROM resource_inventory_items
       GROUP BY category, base_unit
       ORDER BY category`,
    ),
  ]);
  return { ...totals[0], by_category: byCategory };
}

export async function getCategories() {
  const { rows } = await getPool().query(
    'SELECT DISTINCT category FROM resource_inventory_items ORDER BY category',
  );
  return rows.map((row) => row.category);
}

export async function getUsageTimeline(days) {
  const { rows } = await getPool().query(
    `SELECT DATE(m.occurred_at) AS date, i.category, i.base_unit AS unit,
            COALESCE(SUM(-m.quantity_base_change) FILTER (WHERE m.quantity_base_change < 0), 0) AS total_used
     FROM resource_inventory_movements m
     JOIN resource_inventory_items i ON i.id = m.inventory_item_id
     WHERE m.occurred_at >= CURRENT_TIMESTAMP - ($1::integer * INTERVAL '1 day')
     GROUP BY DATE(m.occurred_at), i.category, i.base_unit
     ORDER BY date ASC, i.category ASC`,
    [days],
  );
  return rows;
}

export async function listForecastItems() {
  const { rows } = await getPool().query(
    `SELECT resource_name, category, base_unit AS unit,
            available_base_quantity AS available_quantity,
            minimum_base_quantity AS minimum_threshold, status
     FROM resource_inventory_items
     ORDER BY resource_name ASC`,
  );
  return rows;
}

export async function savePredictionSnapshot({ horizonDays, householdFeatures, inventoryFeatures, prediction }) {
  const { rows } = await getPool().query(
    `INSERT INTO resource_inventory_prediction_snapshots
      (horizon_days, household_features, inventory_features, prediction)
     VALUES ($1, $2, $3, $4)
     RETURNING id, generated_at, horizon_days, household_features, inventory_features, prediction`,
    [horizonDays, householdFeatures, inventoryFeatures, prediction],
  );
  return rows[0];
}
