/**
 * Relief portal repository — orders, payments, deliveries, receipts, catalogue,
 * camp requests, campaigns, staff users, audit log.
 *
 * Follows the donation repository pattern: when DB_ENABLED=false every table
 * lives in module-level Maps so the HTTP layer and tests run without a
 * database. When the pool is available every write is plain SQL against the
 * relief_* tables created by schema.sql.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { getPool } from '../../config/database.js';

const mem = {
  staff: new Map(),
  products: new Map(),
  orders: new Map(), // id -> order
  orderItems: new Map(), // order_id -> [items]
  payments: new Map(),
  paymentEvents: new Map(), // event_id -> event
  deliveries: new Map(),
  deliveryEvents: new Map(), // delivery_id -> [events]
  receipts: new Map(),
  campRequests: new Map(),
  campaigns: new Map(),
  audit: [],
};

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

function db() {
  return env.db.enabled;
}

// ── Staff users ────────────────────────────────────────────────────────────

export async function createStaffUser({ email, passwordHash, displayName, role, orgCode }) {
  const id = uuid();
  const record = {
    id, email, password_hash: passwordHash, display_name: displayName, role,
    org_code: orgCode || null, is_active: true, created_at: now(), updated_at: now(),
  };
  if (!db()) {
    mem.staff.set(id, record);
    return record;
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_staff_users (id, email, password_hash, display_name, role, org_code)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, email, passwordHash, displayName, role, orgCode || null],
  );
  return rows[0];
}

export async function getStaffUserByEmail(email) {
  if (!db()) return [...mem.staff.values()].find((u) => u.email === email) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_staff_users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function getStaffUserById(id) {
  if (!db()) return mem.staff.get(id) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_staff_users WHERE id = $1', [id]);
  return rows[0] || null;
}

// ── Products ───────────────────────────────────────────────────────────────

export async function listProducts({ partnerCode, category, activeOnly = true } = {}) {
  if (!db()) {
    return [...mem.products.values()].filter((p) =>
      (!partnerCode || p.partner_code === partnerCode)
      && (!category || p.category === category)
      && (!activeOnly || p.is_active));
  }
  const conditions = [];
  const params = [];
  if (partnerCode) { params.push(partnerCode); conditions.push(`partner_code = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`category = $${params.length}`); }
  if (activeOnly) conditions.push('is_active = TRUE');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await getPool().query(
    `SELECT * FROM relief_products ${where} ORDER BY partner_code, category, name`, params,
  );
  return rows;
}

export async function upsertProduct(product) {
  const record = {
    partner_code: product.partner_code, sku: product.sku, name: product.name,
    category: product.category, unit: product.unit, unit_price_lkr: product.unit_price_lkr,
    currency: product.currency || 'LKR', stock_quantity: product.stock_quantity ?? null,
    stock_status: product.stock_status || 'UNKNOWN',
    availability_source: product.availability_source || 'MANUAL',
    is_active: product.is_active !== false, last_synced_at: product.last_synced_at || now(),
    updated_at: now(),
  };
  if (!db()) {
    const key = `${record.partner_code}:${record.sku}`;
    const existing = mem.products.get(key);
    if (existing) {
      Object.assign(existing, record);
      return existing;
    }
    const created = { id: mem.products.size + 1, created_at: now(), ...record };
    mem.products.set(key, created);
    return created;
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_products
       (partner_code, sku, name, category, unit, unit_price_lkr, currency,
        stock_quantity, stock_status, availability_source, is_active, last_synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (partner_code, sku) DO UPDATE SET
       name = EXCLUDED.name, category = EXCLUDED.category, unit = EXCLUDED.unit,
       unit_price_lkr = EXCLUDED.unit_price_lkr, stock_quantity = EXCLUDED.stock_quantity,
       stock_status = EXCLUDED.stock_status, availability_source = EXCLUDED.availability_source,
       is_active = EXCLUDED.is_active, last_synced_at = EXCLUDED.last_synced_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [record.partner_code, record.sku, record.name, record.category, record.unit,
      record.unit_price_lkr, record.currency, record.stock_quantity, record.stock_status,
      record.availability_source, record.is_active, record.last_synced_at],
  );
  return rows[0];
}

// ── Orders ─────────────────────────────────────────────────────────────────

export async function createOrder(order, items) {
  const id = order.id || uuid();
  const record = {
    id, reference: order.reference, donor_google_id: order.donor_google_id,
    donor_email: order.donor_email, donor_name: order.donor_name, kind: order.kind,
    partner_code: order.partner_code || null, status: order.status || 'CREATED',
    subtotal_lkr: order.subtotal_lkr || 0, delivery_lkr: order.delivery_lkr || 0,
    total_lkr: order.total_lkr || 0, destination_type: order.destination_type || null,
    destination_code: order.destination_code || null, destination_name: order.destination_name || null,
    message: order.message || null, idempotency_key: order.idempotency_key || null,
    created_at: now(), updated_at: now(),
  };
  const itemRecords = items.map((item, index) => ({
    id: index + 1, order_id: id, partner_code: item.partner_code, sku: item.sku,
    name: item.name, category: item.category, unit: item.unit,
    unit_price_lkr: item.unit_price_lkr, quantity: item.quantity, line_total_lkr: item.line_total_lkr,
  }));
  if (!db()) {
    mem.orders.set(id, record);
    mem.orderItems.set(id, itemRecords);
    return { ...record, items: itemRecords };
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO relief_orders
         (id, reference, donor_google_id, donor_email, donor_name, kind, partner_code, status,
          subtotal_lkr, delivery_lkr, total_lkr, destination_type, destination_code,
          destination_name, message, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [id, record.reference, record.donor_google_id, record.donor_email, record.donor_name,
        record.kind, record.partner_code, record.status, record.subtotal_lkr, record.delivery_lkr,
        record.total_lkr, record.destination_type, record.destination_code, record.destination_name,
        record.message, record.idempotency_key],
    );
    const storedItems = [];
    for (const item of items) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO relief_order_items
           (order_id, partner_code, sku, name, category, unit, unit_price_lkr, quantity, line_total_lkr)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [id, item.partner_code, item.sku, item.name, item.category, item.unit,
          item.unit_price_lkr, item.quantity, item.line_total_lkr],
      );
      storedItems.push(itemRows[0]);
    }
    await client.query('COMMIT');
    return { ...rows[0], items: storedItems };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw Object.assign(new Error('Duplicate idempotency key'), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getOrderById(id) {
  const order = db() ? null : mem.orders.get(id);
  if (!db()) return order ? { ...order, items: mem.orderItems.get(id) || [] } : null;
  const { rows } = await getPool().query('SELECT * FROM relief_orders WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const { rows: items } = await getPool().query('SELECT * FROM relief_order_items WHERE order_id = $1', [id]);
  return { ...rows[0], items };
}

export async function getOrderByReference(reference) {
  if (!db()) {
    const found = [...mem.orders.values()].find((o) => o.reference === reference);
    return found ? getOrderById(found.id) : null;
  }
  const { rows } = await getPool().query('SELECT * FROM relief_orders WHERE reference = $1', [reference]);
  if (!rows[0]) return null;
  return getOrderById(rows[0].id);
}

export async function getOrderByIdempotencyKey(key) {
  if (!key) return null;
  if (!db()) {
    const found = [...mem.orders.values()].find((o) => o.idempotency_key === key);
    return found ? getOrderById(found.id) : null;
  }
  const { rows } = await getPool().query('SELECT * FROM relief_orders WHERE idempotency_key = $1', [key]);
  if (!rows[0]) return null;
  return getOrderById(rows[0].id);
}

export async function getOrdersByDonor(donorGoogleId, limit = 50) {
  if (!db()) {
    return [...mem.orders.values()]
      .filter((o) => o.donor_google_id === donorGoogleId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((o) => ({ ...o, items: mem.orderItems.get(o.id) || [] }));
  }
  const { rows } = await getPool().query(
    'SELECT * FROM relief_orders WHERE donor_google_id = $1 ORDER BY created_at DESC LIMIT $2',
    [donorGoogleId, limit],
  );
  return Promise.all(rows.map((row) => getOrderById(row.id)));
}

export async function listOrders({ status, partnerCode, limit = 100 } = {}) {
  if (!db()) {
    return [...mem.orders.values()]
      .filter((o) => (!status || o.status === status) && (!partnerCode || o.partner_code === partnerCode))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((o) => ({ ...o, items: mem.orderItems.get(o.id) || [] }));
  }
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (partnerCode) { params.push(partnerCode); conditions.push(`partner_code = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await getPool().query(
    `SELECT * FROM relief_orders ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return Promise.all(rows.map((row) => getOrderById(row.id)));
}

export async function updateOrderStatus(id, status) {
  if (!db()) {
    const order = mem.orders.get(id);
    if (!order) return null;
    order.status = status;
    order.updated_at = now();
    return { ...order };
  }
  const { rows } = await getPool().query(
    `UPDATE relief_orders SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, status],
  );
  return rows[0] || null;
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function createPayment(payment) {
  const id = payment.id || uuid();
  const record = {
    id, order_id: payment.order_id, provider: payment.provider,
    status: payment.status || 'PENDING', amount_lkr: payment.amount_lkr,
    currency: payment.currency || 'LKR', provider_reference: payment.provider_reference || null,
    payer_reference: payment.payer_reference || null, verified_by: payment.verified_by || null,
    verified_at: payment.verified_at || null, created_at: now(), updated_at: now(),
  };
  if (!db()) {
    mem.payments.set(id, record);
    return { ...record };
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_payments
       (id, order_id, provider, status, amount_lkr, currency, provider_reference, payer_reference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, record.order_id, record.provider, record.status, record.amount_lkr, record.currency,
      record.provider_reference, record.payer_reference],
  );
  return rows[0];
}

export async function getPaymentById(id) {
  if (!db()) return mem.payments.get(id) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_payments WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getPaymentByProviderReference(reference) {
  if (!reference) return null;
  if (!db()) return [...mem.payments.values()].find((p) => p.provider_reference === reference) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_payments WHERE provider_reference = $1', [reference]);
  return rows[0] || null;
}

export async function listPaymentsByOrder(orderId) {
  if (!db()) return [...mem.payments.values()].filter((p) => p.order_id === orderId);
  const { rows } = await getPool().query('SELECT * FROM relief_payments WHERE order_id = $1 ORDER BY created_at', [orderId]);
  return rows;
}

export async function listPayments({ status, limit = 100 } = {}) {
  if (!db()) {
    return [...mem.payments.values()]
      .filter((p) => !status || p.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const params = [];
  let where = '';
  if (status) { params.push(status); where = 'WHERE status = $1'; }
  const { rows } = await getPool().query(
    `SELECT * FROM relief_payments ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return rows;
}

/** Marks a payment VERIFIED. Only called after signature verification or an
 *  authorised staff confirmation — never from raw user input. */
export async function markPaymentVerified(id, { verifiedBy, providerReference }) {
  if (!db()) {
    const payment = mem.payments.get(id);
    if (!payment) return null;
    Object.assign(payment, { status: 'VERIFIED', verified_by: verifiedBy || null, verified_at: now(), updated_at: now() });
    if (providerReference) payment.provider_reference = providerReference;
    return { ...payment };
  }
  const { rows } = await getPool().query(
    `UPDATE relief_payments
     SET status = 'VERIFIED', verified_by = $2, verified_at = CURRENT_TIMESTAMP,
         provider_reference = COALESCE($3, provider_reference), updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, verifiedBy || null, providerReference || null],
  );
  return rows[0] || null;
}

export async function updatePaymentStatus(id, status, { providerReference, payerReference } = {}) {
  if (!db()) {
    const payment = mem.payments.get(id);
    if (!payment) return null;
    payment.status = status;
    if (providerReference !== undefined) payment.provider_reference = providerReference;
    if (payerReference !== undefined) payment.payer_reference = payerReference;
    payment.updated_at = now();
    return { ...payment };
  }
  const { rows } = await getPool().query(
    `UPDATE relief_payments
     SET status = $2,
         provider_reference = COALESCE($3, provider_reference),
         payer_reference = COALESCE($4, payer_reference),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, status, providerReference || null, payerReference || null],
  );
  return rows[0] || null;
}

/**
 * Records a webhook/callback event exactly once. Returns
 * { duplicate: true, event } when the event_id was already processed, so the
 * caller can acknowledge without mutating state again.
 */
export async function recordPaymentEvent(event) {
  const eventId = event.event_id;
  if (!db()) {
    if (mem.paymentEvents.has(eventId)) return { duplicate: true, event: mem.paymentEvents.get(eventId) };
    const stored = { id: mem.paymentEvents.size + 1, received_at: now(), ...event };
    mem.paymentEvents.set(eventId, stored);
    return { duplicate: false, event: stored };
  }
  const { rows: existing } = await getPool().query(
    'SELECT * FROM relief_payment_events WHERE event_id = $1', [eventId],
  );
  if (existing[0]) return { duplicate: true, event: existing[0] };
  const { rows } = await getPool().query(
    `INSERT INTO relief_payment_events (event_id, payment_id, provider, event_type, payload, signature_ok, process_result)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [eventId, event.payment_id || null, event.provider, event.event_type || null,
      event.payload ? JSON.stringify(event.payload) : null, Boolean(event.signature_ok),
      event.process_result || null],
  );
  return { duplicate: false, event: rows[0] };
}

export async function updatePaymentEventResult(eventId, processResult) {
  if (!db()) {
    const event = mem.paymentEvents.get(eventId);
    if (event) event.process_result = processResult;
    return;
  }
  await getPool().query(
    'UPDATE relief_payment_events SET process_result = $2 WHERE event_id = $1',
    [eventId, processResult],
  );
}

// ── Deliveries ─────────────────────────────────────────────────────────────

export async function createDelivery(delivery) {
  const id = delivery.id || uuid();
  const record = {
    id, order_id: delivery.order_id, provider: delivery.provider,
    status: delivery.status || 'REQUESTED', quote_estimate_lkr: delivery.quote_estimate_lkr ?? null,
    provider_reference: delivery.provider_reference || null, tracking_url: delivery.tracking_url || null,
    manual_reference: delivery.manual_reference || null, pickup_note: delivery.pickup_note || null,
    booked_by: delivery.booked_by || null, booked_at: delivery.booked_at || null,
    delivered_at: delivery.delivered_at || null, created_at: now(), updated_at: now(),
  };
  if (!db()) {
    mem.deliveries.set(id, record);
    mem.deliveryEvents.set(id, [{
      id: 1, delivery_id: id, status: record.status, provider_reference: record.provider_reference,
      note: 'Delivery requested', actor: record.booked_by, occurred_at: now(),
    }]);
    return { ...record };
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO relief_deliveries
         (id, order_id, provider, status, quote_estimate_lkr, provider_reference, tracking_url,
          manual_reference, pickup_note, booked_by, booked_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, record.order_id, record.provider, record.status, record.quote_estimate_lkr,
        record.provider_reference, record.tracking_url, record.manual_reference,
        record.pickup_note, record.booked_by, record.booked_at],
    );
    await client.query(
      `INSERT INTO relief_delivery_events (delivery_id, status, provider_reference, note, actor)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, record.status, record.provider_reference, 'Delivery requested', record.booked_by],
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw Object.assign(new Error('A delivery with this provider reference already exists'), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function getDeliveryById(id) {
  if (!db()) {
    const delivery = mem.deliveries.get(id);
    return delivery ? { ...delivery, events: mem.deliveryEvents.get(id) || [] } : null;
  }
  const { rows } = await getPool().query('SELECT * FROM relief_deliveries WHERE id = $1', [id]);
  if (!rows[0]) return null;
  const { rows: events } = await getPool().query(
    'SELECT * FROM relief_delivery_events WHERE delivery_id = $1 ORDER BY occurred_at', [id],
  );
  return { ...rows[0], events };
}

export async function getDeliveriesByOrder(orderId) {
  if (!db()) {
    return [...mem.deliveries.values()].filter((d) => d.order_id === orderId).map((d) => ({ ...d }));
  }
  const { rows } = await getPool().query(
    'SELECT * FROM relief_deliveries WHERE order_id = $1 ORDER BY created_at', [orderId],
  );
  return rows;
}

export async function listDeliveries({ status, provider, limit = 100 } = {}) {
  if (!db()) {
    return [...mem.deliveries.values()]
      .filter((d) => (!status || d.status === status) && (!provider || d.provider === provider))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (provider) { params.push(provider); conditions.push(`provider = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await getPool().query(
    `SELECT * FROM relief_deliveries ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return rows;
}

export async function updateDelivery(id, fields) {
  const allowed = ['status', 'quote_estimate_lkr', 'provider_reference', 'tracking_url',
    'manual_reference', 'pickup_note', 'booked_by', 'booked_at', 'delivered_at'];
  const updates = [];
  const params = [id];
  for (const field of allowed) {
    if (fields[field] !== undefined) {
      params.push(fields[field]);
      updates.push(`${field} = $${params.length}`);
    }
  }
  if (!updates.length) return getDeliveryById(id);
  if (!db()) {
    const delivery = mem.deliveries.get(id);
    if (!delivery) return null;
    for (const field of allowed) {
      if (fields[field] !== undefined) delivery[field] = fields[field];
    }
    delivery.updated_at = now();
    return { ...delivery };
  }
  params.push(new Date());
  const { rows } = await getPool().query(
    `UPDATE relief_deliveries SET ${updates.join(', ')}, updated_at = $${params.length}
     WHERE id = $1 RETURNING *`,
    params,
  );
  return rows[0] || null;
}

export async function addDeliveryEvent({ deliveryId, status, providerReference, note, actor }) {
  if (!db()) {
    const events = mem.deliveryEvents.get(deliveryId) || [];
    const event = {
      id: events.length + 1, delivery_id: deliveryId, status,
      provider_reference: providerReference || null, note: note || null,
      actor: actor || null, occurred_at: now(),
    };
    events.push(event);
    mem.deliveryEvents.set(deliveryId, events);
    return event;
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_delivery_events (delivery_id, status, provider_reference, note, actor)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [deliveryId, status, providerReference || null, note || null, actor || null],
  );
  return rows[0];
}

// ── Receipts ───────────────────────────────────────────────────────────────

export async function createReceipt(receipt) {
  const id = receipt.id || uuid();
  const record = {
    id, delivery_id: receipt.delivery_id, order_id: receipt.order_id,
    received_by: receipt.received_by, received_role: receipt.received_role,
    condition: receipt.condition || 'INTACT', item_count: receipt.item_count ?? null,
    notes: receipt.notes || null, inventory_applied: Boolean(receipt.inventory_applied),
    created_at: now(),
  };
  if (!db()) {
    mem.receipts.set(id, record);
    return { ...record };
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_receipts
       (id, delivery_id, order_id, received_by, received_role, condition, item_count, notes, inventory_applied)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [id, record.delivery_id, record.order_id, record.received_by, record.received_role,
      record.condition, record.item_count, record.notes, record.inventory_applied],
  );
  return rows[0];
}

export async function getReceiptByDelivery(deliveryId) {
  if (!db()) return [...mem.receipts.values()].find((r) => r.delivery_id === deliveryId) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_receipts WHERE delivery_id = $1', [deliveryId]);
  return rows[0] || null;
}

// ── Camp requests ──────────────────────────────────────────────────────────

export async function createCampRequest(request) {
  const id = request.id || uuid();
  const record = {
    id, camp_id: request.camp_id, requested_by: request.requested_by,
    resource_name: request.resource_name, category: request.category,
    quantity: request.quantity, unit: request.unit, priority: request.priority || 'NORMAL',
    status: 'OPEN', notes: request.notes || null, created_at: now(), updated_at: now(),
  };
  if (!db()) {
    mem.campRequests.set(id, record);
    return { ...record };
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_camp_requests
       (camp_id, requested_by, resource_name, category, quantity, unit, priority, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [record.camp_id, record.requested_by, record.resource_name, record.category,
      record.quantity, record.unit, record.priority, record.notes],
  );
  return rows[0];
}

export async function getCampRequestById(id) {
  if (!db()) return mem.campRequests.get(id) || null;
  const { rows } = await getPool().query('SELECT * FROM relief_camp_requests WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listCampRequests({ status, campId, limit = 100 } = {}) {
  if (!db()) {
    return [...mem.campRequests.values()]
      .filter((r) => (!status || r.status === status) && (!campId || r.camp_id === campId))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const conditions = [];
  const params = [];
  if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
  if (campId) { params.push(campId); conditions.push(`camp_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await getPool().query(
    `SELECT * FROM relief_camp_requests ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return rows;
}

export async function updateCampRequestStatus(id, status) {
  if (!db()) {
    const request = mem.campRequests.get(id);
    if (!request) return null;
    request.status = status;
    request.updated_at = now();
    return { ...request };
  }
  const { rows } = await getPool().query(
    `UPDATE relief_camp_requests SET status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, status],
  );
  return rows[0] || null;
}

// ── Campaigns ──────────────────────────────────────────────────────────────

export async function listCampaigns({ activeOnly = false } = {}) {
  if (!db()) {
    return [...mem.campaigns.values()].filter((c) => !activeOnly || c.status === 'ACTIVE');
  }
  const where = activeOnly ? "WHERE status = 'ACTIVE'" : '';
  const { rows } = await getPool().query(`SELECT * FROM relief_campaigns ${where} ORDER BY created_at DESC`);
  return rows;
}

export async function upsertCampaign(campaign) {
  const id = campaign.id || uuid();
  const record = {
    id, slug: campaign.slug, title: campaign.title, description: campaign.description || null,
    goal_amount_lkr: campaign.goal_amount_lkr || 0, status: campaign.status || 'ACTIVE',
    starts_at: campaign.starts_at || null, ends_at: campaign.ends_at || null,
    created_at: now(), updated_at: now(),
  };
  if (!db()) {
    const existing = [...mem.campaigns.values()].find((c) => c.slug === record.slug);
    if (existing) {
      Object.assign(existing, record, { id: existing.id, created_at: existing.created_at });
      return { ...existing };
    }
    mem.campaigns.set(id, record);
    return { ...record };
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_campaigns (id, slug, title, description, goal_amount_lkr, status, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title, description = EXCLUDED.description,
       goal_amount_lkr = EXCLUDED.goal_amount_lkr, status = EXCLUDED.status,
       starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [id, record.slug, record.title, record.description, record.goal_amount_lkr,
      record.status, record.starts_at, record.ends_at],
  );
  return rows[0];
}

// ── Transparency aggregates ────────────────────────────────────────────────

/** Verified donation/purchase totals derived from VERIFIED payments only. */
export async function getTransparencySummary() {
  if (!db()) {
    const verified = [...mem.payments.values()].filter((p) => p.status === 'VERIFIED');
    const totalLkr = verified.reduce((sum, p) => sum + Number(p.amount_lkr), 0);
    const orders = [...mem.orders.values()];
    const delivered = orders.filter((o) => ['DELIVERED', 'RECEIVED'].includes(o.status)).length;
    const received = orders.filter((o) => o.status === 'RECEIVED').length;
    return {
      verified_donations_lkr: totalLkr,
      verified_payment_count: verified.length,
      orders_total: orders.length,
      orders_delivered: delivered,
      orders_received: received,
      purchases_total: orders.filter((o) => o.kind === 'RESOURCE_PURCHASE').length,
    };
  }
  const { rows } = await getPool().query(
    `SELECT
       COALESCE((SELECT SUM(amount_lkr) FROM relief_payments WHERE status = 'VERIFIED'), 0) AS verified_donations_lkr,
       (SELECT COUNT(*) FROM relief_payments WHERE status = 'VERIFIED') AS verified_payment_count,
       (SELECT COUNT(*) FROM relief_orders) AS orders_total,
       (SELECT COUNT(*) FROM relief_orders WHERE status IN ('DELIVERED', 'RECEIVED')) AS orders_delivered,
       (SELECT COUNT(*) FROM relief_orders WHERE status = 'RECEIVED') AS orders_received,
       (SELECT COUNT(*) FROM relief_orders WHERE kind = 'RESOURCE_PURCHASE') AS purchases_total`,
  );
  return rows[0];
}

// ── Audit ──────────────────────────────────────────────────────────────────

export async function logAudit({ actor, actorRole, action, entityType, entityId, details }) {
  const record = {
    id: mem.audit.length + 1, actor, actor_role: actorRole || null, action,
    entity_type: entityType || null, entity_id: entityId ? String(entityId) : null,
    details: details || null, created_at: now(),
  };
  if (!db()) {
    mem.audit.push(record);
    return record;
  }
  const { rows } = await getPool().query(
    `INSERT INTO relief_audit_logs (actor, actor_role, action, entity_type, entity_id, details)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [record.actor, record.actor_role, record.action, record.entity_type, record.entity_id,
      record.details ? JSON.stringify(record.details) : null],
  );
  return rows[0];
}

export async function listAudit({ action, limit = 100 } = {}) {
  if (!db()) {
    return mem.audit
      .filter((entry) => !action || entry.action === action)
      .slice(-limit)
      .reverse();
  }
  const params = [];
  let where = '';
  if (action) { params.push(action); where = 'WHERE action = $1'; }
  const { rows } = await getPool().query(
    `SELECT * FROM relief_audit_logs ${where} ORDER BY created_at DESC LIMIT $${params.length + 1}`,
    [...params, limit],
  );
  return rows;
}

/** Test helper — clears in-memory state between suites. */
export function _resetMemory() {
  for (const key of Object.keys(mem)) {
    if (Array.isArray(mem[key])) mem[key].length = 0;
    else mem[key].clear();
  }
}
