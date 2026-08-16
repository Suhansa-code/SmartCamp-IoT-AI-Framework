import { campDb as db } from '../../config/database.js';

const VALID_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK', 'INACTIVE'];
const MEALS = ['breakfast', 'lunch', 'dinner'];

// ── Audit helper (shared with wristbands) ─────────────────────────────
export function audit({ actor, action, person_id, resource_id, wristband_id, quantity, details }) {
  db.prepare(`
    INSERT INTO audit_logs (actor, action, person_id, resource_id, wristband_id, quantity, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(actor || 'STAFF', action, person_id || null, resource_id || null, wristband_id || null,
    quantity ?? null, details || null);
}

export function getAuditLogs({ action, person_id, limit = 100 } = {}) {
  const conditions = [];
  const params = [];
  if (action) { conditions.push('action = ?'); params.push(action); }
  if (person_id) { conditions.push('person_id = ?'); params.push(Number(person_id)); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ?
  `).all(...params, Math.min(parseInt(limit) || 100, 500));
  return { logs: rows, total: rows.length };
}

// ── Resource catalog ───────────────────────────────────────────────────
export function getAllResources({ q, category, low_stock } = {}) {
  const conditions = [];
  const params = [];
  if (q) { conditions.push('resource_name LIKE ?'); params.push(`%${q}%`); }
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (low_stock === 'true' || low_stock === '1') {
    conditions.push('status != ? AND available_quantity <= minimum_threshold');
    params.push('INACTIVE');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT *, (total_quantity - available_quantity) AS distributed_quantity,
           (available_quantity <= minimum_threshold AND status != 'INACTIVE') AS low_stock
    FROM resources ${where}
    ORDER BY category, resource_name
  `).all(...params);
  return { resources: rows, total: rows.length };
}

export function getResourceById(id) {
  const resource = db.prepare(`
    SELECT *, (total_quantity - available_quantity) AS distributed_quantity,
           (available_quantity <= minimum_threshold AND status != 'INACTIVE') AS low_stock
    FROM resources WHERE id = ?
  `).get(Number(id));
  if (!resource) throw Object.assign(new Error('Resource does not exist.'), { status: 404 });
  return resource;
}

export function createResource({ resource_name, category, unit, total_quantity, minimum_threshold, status }) {
  if (!resource_name || !String(resource_name).trim()) {
    throw Object.assign(new Error('resource_name is required'), { status: 400 });
  }
  const total = Number(total_quantity);
  if (isNaN(total) || total < 0) {
    throw Object.assign(new Error('total_quantity must be a non-negative number'), { status: 400 });
  }

  const existing = db.prepare('SELECT id FROM resources WHERE resource_name = ?').get(String(resource_name).trim());
  if (existing) {
    throw Object.assign(new Error('A resource with this name already exists.'), { status: 409 });
  }

  const result = db.prepare(`
    INSERT INTO resources (resource_name, category, unit, total_quantity, available_quantity, minimum_threshold, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(resource_name).trim(),
    category || 'General',
    unit || 'portion',
    total,
    total,
    Number(minimum_threshold) || 0,
    VALID_STATUSES.includes(status) ? status : 'AVAILABLE',
  );

  const resource = getResourceById(result.lastInsertRowid);
  audit({ actor: null, action: 'resource_create', resource_id: resource.id, quantity: total, details: `${resource.resource_name}` });
  return resource;
}

export function updateResource(id, data) {
  const existing = getResourceById(id);

  const fields = [];
  const params = [];
  for (const field of ['resource_name', 'category', 'unit', 'minimum_threshold', 'status']) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
      if (field === 'status' && !VALID_STATUSES.includes(data[field])) {
        throw Object.assign(new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`), { status: 400 });
      }
      fields.push(`${field} = ?`);
      params.push(field === 'minimum_threshold' ? Number(data[field]) : data[field]);
    }
  }

  // Restocking: reset available quantity towards a new total.
  if (data.total_quantity !== undefined) {
    const total = Number(data.total_quantity);
    if (isNaN(total) || total < 0) {
      throw Object.assign(new Error('total_quantity must be a non-negative number'), { status: 400 });
    }
    fields.push('total_quantity = ?');
    fields.push('available_quantity = ?');
    params.push(total, Math.max(0, total - (existing.total_quantity - existing.available_quantity)));
  }

  if (fields.length === 0) {
    throw Object.assign(new Error('No fields to update'), { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  params.push(Number(id));

  db.prepare(`UPDATE resources SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  const resource = getResourceById(id);
  audit({
    actor: null, action: 'resource_update', resource_id: resource.id,
    details: `${resource.resource_name}`,
  });
  return resource;
}

// ── Consumption (transaction-safe) ─────────────────────────────────────
/**
 * Record that a person received a resource. Runs inside a single SQLite
 * transaction so two staff members can never over-consume the same unit:
 * the available quantity is re-checked and decremented atomically.
 */
export function recordResourceUsage({ person_id, resource_id, meal, quantity, recorded_by }) {
  const personId = Number(person_id);
  const resourceId = Number(resource_id);
  const qty = Number(quantity);

  if (!personId || !resourceId || isNaN(qty) || qty <= 0) {
    throw Object.assign(new Error('person_id, resource_id and a positive quantity are required'), { status: 400 });
  }

  const person = db.prepare('SELECT id, full_name FROM persons WHERE id = ? AND is_active = 1').get(personId);
  if (!person) throw Object.assign(new Error('Person is inactive or does not exist.'), { status: 400 });

  const mealKey = meal ? String(meal).toLowerCase().trim() : null;
  if (mealKey && !MEALS.includes(mealKey)) {
    throw Object.assign(new Error(`meal must be one of: ${MEALS.join(', ')}`), { status: 400 });
  }

  const record = db.transaction(() => {
    const resource = db.prepare('SELECT * FROM resources WHERE id = ? AND status != ?').get(resourceId, 'INACTIVE');
    if (!resource) throw Object.assign(new Error('Resource does not exist.'), { status: 404 });

    // Duplicate prevention: same resource may only be given once per meal/day.
    if (mealKey) {
      const dup = db.prepare(
        "SELECT id FROM resource_usage WHERE person_id = ? AND resource_id = ? AND meal = ? AND date = date('now')"
      ).get(personId, resourceId, mealKey);
      if (dup) {
        throw Object.assign(new Error(`This person has already received ${resource.resource_name} for ${mealKey} today.`), { status: 409 });
      }
    } else {
      const dup = db.prepare(
        "SELECT id FROM resource_usage WHERE person_id = ? AND resource_id = ? AND date = date('now')"
      ).get(personId, resourceId);
      if (dup) {
        throw Object.assign(new Error(`This person has already received ${resource.resource_name} today.`), { status: 409 });
      }
    }

    if (resource.available_quantity < qty) {
      throw Object.assign(new Error(`Resource quantity is insufficient. Only ${resource.available_quantity} ${resource.unit}(s) remaining.`), { status: 409 });
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8);

    const result = db.prepare(`
      INSERT INTO resource_usage (person_id, resource_id, meal, quantity, date, time, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(personId, resourceId, mealKey, qty, dateStr, timeStr, recorded_by || 'STAFF');

    db.prepare('UPDATE resources SET available_quantity = available_quantity - ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(qty, resourceId);

    if (resource.available_quantity - qty <= resource.minimum_threshold) {
      db.prepare("UPDATE resources SET status = 'AVAILABLE', updated_at = datetime('now') WHERE id = ?").run(resourceId);
    }

    audit({
      actor: recorded_by, action: 'resource_given', person_id: personId, resource_id: resourceId,
      quantity: qty, details: `${resource.resource_name} ${qty} ${resource.unit}${mealKey ? ` (${mealKey})` : ''}`,
    });

    return { usage_id: result.lastInsertRowid, resource };
  });

  const { usage_id, resource } = record();
  return { success: true, usage_id, person: person.full_name, resource_name: resource.resource_name, available_quantity: resource.available_quantity - qty };
}

// ── History ────────────────────────────────────────────────────────────
export function getResourceUsage({ person_id, resource_id, meal, from, to, limit = 100 } = {}) {
  const conditions = [];
  const params = [];
  if (person_id) { conditions.push('ru.person_id = ?'); params.push(Number(person_id)); }
  if (resource_id) { conditions.push('ru.resource_id = ?'); params.push(Number(resource_id)); }
  if (meal) { conditions.push('ru.meal = ?'); params.push(String(meal).toLowerCase()); }
  if (from) { conditions.push('ru.date >= ?'); params.push(String(from)); }
  if (to) { conditions.push('ru.date <= ?'); params.push(String(to)); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT ru.id, ru.person_id, p.full_name, p.fingerprint_id, ru.resource_id, r.resource_name,
           r.unit, ru.meal, ru.quantity, ru.date, ru.time, ru.recorded_by, ru.created_at
    FROM resource_usage ru
    JOIN persons p ON p.id = ru.person_id
    JOIN resources r ON r.id = ru.resource_id
    ${where}
    ORDER BY ru.date DESC, ru.time DESC
    LIMIT ?
  `).all(...params, Math.min(parseInt(limit) || 100, 500));

  return { usage: rows, total: rows.length };
}

export function getPersonResourceHistory(personId, { days } = {}) {
  const person = db.prepare('SELECT id FROM persons WHERE id = ?').get(Number(personId));
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  let dateFilter = '';
  const params = [Number(personId)];
  if (days) {
    dateFilter = "AND ru.date >= date('now', ? || ' days')";
    params.push(`-${parseInt(days, 10)}`);
  }

  const rows = db.prepare(`
    SELECT ru.id, ru.meal, ru.quantity, ru.date, ru.time, r.resource_name, r.unit, r.category
    FROM resource_usage ru
    JOIN resources r ON r.id = ru.resource_id
    WHERE ru.person_id = ? ${dateFilter}
    ORDER BY ru.date DESC, ru.time DESC
  `).all(...params);

  const byDate = {};
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = { date: row.date, meals: {} };
    const meal = row.meal || 'Other';
    if (!byDate[row.date].meals[meal]) byDate[row.date].meals[meal] = [];
    byDate[row.date].meals[meal].push(row);
  }

  return {
    person_id: Number(personId),
    history: Object.values(byDate).sort((a, b) => (a.date < b.date ? 1 : -1)),
    total_records: rows.length,
  };
}

// ── Dashboard summary ──────────────────────────────────────────────────
export function getInventorySummary() {
  const resources = db.prepare(`
    SELECT *, (total_quantity - available_quantity) AS distributed_quantity,
           (available_quantity <= minimum_threshold AND status != 'INACTIVE') AS low_stock
    FROM resources WHERE status != 'INACTIVE' ORDER BY category, resource_name
  `).all();

  const todayRows = db.prepare(`
    SELECT r.resource_name, r.unit, SUM(ru.quantity) AS qty, COUNT(*) AS times
    FROM resource_usage ru JOIN resources r ON r.id = ru.resource_id
    WHERE ru.date = date('now') GROUP BY r.id ORDER BY r.resource_name
  `).all();

  const lowStock = resources.filter((r) => r.low_stock);

  return {
    resources,
    low_stock: lowStock,
    low_stock_count: lowStock.length,
    distributed_today: todayRows.map((r) => ({ resource_name: r.resource_name, unit: r.unit, quantity: r.qty, times: r.times })),
  };
}

export function getCategories() {
  const rows = db.prepare('SELECT DISTINCT category FROM resources WHERE category IS NOT NULL ORDER BY category').all();
  return rows.map((r) => r.category);
}
