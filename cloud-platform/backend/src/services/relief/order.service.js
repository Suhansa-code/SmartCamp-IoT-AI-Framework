/**
 * Order service — creates relief orders (money donations and resource
 * purchases) and owns the order status machine.
 *
 * Prices are ALWAYS taken from the server-side catalogue, never from the
 * client payload. Idempotency: a repeated POST with the same Idempotency-Key
 * header returns the original order instead of creating a duplicate.
 */
import * as repository from '../../data/relief/relief.repository.js';
import { getCatalogues } from './catalogue.service.js';

const ORDER_STATUS_FLOW = {
  CREATED: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED', 'EXPIRED'],
  PAID: ['CONFIRMED_WITH_PARTNER', 'CANCELLED'],
  CONFIRMED_WITH_PARTNER: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const DESTINATIONS = {
  COLLECTION_CENTRE: [
    { code: 'CC-KLN', name: 'Kolonnawa Collection Centre', address: 'Kolonnawa, Colombo District' },
    { code: 'CC-KTY', name: 'Kandy Collection Centre', address: 'Kandy Municipal Market yard' },
    { code: 'CC-JAF', name: 'Jaffna Collection Centre', address: 'Jaffna Town Hall annexe' },
  ],
  CAMP: [
    { code: 'SCB-UNIT-01', name: 'SmartCamp Unit 01 Relief Camp', address: 'Gampaha District' },
    { code: 'CAMP-ELP', name: 'Elpitiya Temporary Camp', address: 'Galle District' },
  ],
};

function reference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.floor(Math.random() * 46656).toString(36).toUpperCase().padStart(3, '0');
  return `SRO-${stamp}-${suffix}`;
}

export function allowedTransition(from, to) {
  return (ORDER_STATUS_FLOW[from] || []).includes(to);
}

/** Validates a destination against the published list. */
export function resolveDestination(type, code) {
  if (!type || !code) return null;
  const list = DESTINATIONS[type] || [];
  const found = list.find((d) => d.code === code);
  if (!found) {
    throw Object.assign(new Error(`Unknown destination ${code} for ${type}`), { status: 400 });
  }
  return { destination_type: type, destination_code: found.code, destination_name: found.name };
}

/**
 * Creates a resource-purchase order from a cart of { partner_code, sku, quantity }.
 * Unit prices are re-read from the catalogue server-side.
 */
export async function createPurchaseOrder({ donor, cart, destinationType, destinationCode, message, idempotencyKey }) {
  if (!Array.isArray(cart) || !cart.length) {
    throw Object.assign(new Error('cart must be a non-empty array'), { status: 400 });
  }
  if (idempotencyKey) {
    const existing = await repository.getOrderByIdempotencyKey(idempotencyKey);
    if (existing) return { order: existing, idempotentReplay: true };
  }

  const destination = resolveDestination(destinationType, destinationCode);
  if (!destination) {
    throw Object.assign(new Error('destination_type and destination_code are required'), { status: 400 });
  }

  // Load every partner in the cart and index products by sku.
  const partnerCodes = [...new Set(cart.map((line) => String(line.partner_code || '').toUpperCase()))];
  const catalogues = await getCatalogues();
  const productIndex = new Map();
  for (const catalogue of catalogues) {
    if (!partnerCodes.includes(catalogue.partner_code)) continue;
    for (const product of catalogue.products) {
      productIndex.set(`${catalogue.partner_code}:${product.sku}`, product);
    }
  }

  const lines = [];
  for (const line of cart) {
    const partnerCode = String(line.partner_code || '').toUpperCase();
    const sku = String(line.sku || '');
    const quantity = Number(line.quantity);
    const product = productIndex.get(`${partnerCode}:${sku}`);
    if (!product) {
      throw Object.assign(new Error(`Unknown product ${partnerCode}/${sku}`), { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
      throw Object.assign(new Error(`Invalid quantity for ${sku}`), { status: 400 });
    }
    if (!product.is_orderable) {
      throw Object.assign(new Error(`${product.name} is out of stock at ${partnerCode}`), { status: 409 });
    }
    lines.push({
      partner_code: partnerCode,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      unit_price_lkr: product.unit_price_lkr,
      quantity,
      line_total_lkr: Number((product.unit_price_lkr * quantity).toFixed(2)),
      availability_source: product.availability_source,
    });
  }

  const partnerCode = lines[0].partner_code;
  if (lines.some((line) => line.partner_code !== partnerCode)) {
    throw Object.assign(new Error('One order can contain items from a single partner supermarket'), { status: 400 });
  }

  const subtotal = Number(lines.reduce((sum, line) => sum + line.line_total_lkr, 0).toFixed(2));
  const order = await repository.createOrder({
    reference: reference(),
    donor_google_id: donor.id,
    donor_email: donor.email,
    donor_name: donor.name,
    kind: 'RESOURCE_PURCHASE',
    partner_code: partnerCode,
    status: 'CREATED',
    subtotal_lkr: subtotal,
    delivery_lkr: 0,
    total_lkr: subtotal,
    ...destination,
    message: message ? String(message).slice(0, 500) : null,
    idempotency_key: idempotencyKey || null,
  }, lines);
  return { order, idempotentReplay: false };
}

/** Creates a MONEY_DONATION order (amount in LKR). */
export async function createDonationOrder({ donor, amountLkr, message, idempotencyKey }) {
  const amount = Number(amountLkr);
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) {
    throw Object.assign(new Error('Donation must be between LKR 100 and LKR 10,000,000'), { status: 400 });
  }
  if (idempotencyKey) {
    const existing = await repository.getOrderByIdempotencyKey(idempotencyKey);
    if (existing) return { order: existing, idempotentReplay: true };
  }
  const rounded = Number(amount.toFixed(2));
  const order = await repository.createOrder({
    reference: reference(),
    donor_google_id: donor.id,
    donor_email: donor.email,
    donor_name: donor.name,
    kind: 'MONEY_DONATION',
    status: 'CREATED',
    subtotal_lkr: rounded,
    delivery_lkr: 0,
    total_lkr: rounded,
    message: message ? String(message).slice(0, 500) : null,
    idempotency_key: idempotencyKey || null,
  }, []);
  return { order, idempotentReplay: false };
}

export async function transitionStatus(orderId, toStatus) {
  const order = await repository.getOrderById(orderId);
  if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (!allowedTransition(order.status, toStatus)) {
    throw Object.assign(
      new Error(`Cannot move order from ${order.status} to ${toStatus}`),
      { status: 409 },
    );
  }
  return repository.updateOrderStatus(orderId, toStatus);
}

export function publicView(order) {
  return {
    reference: order.reference,
    kind: order.kind,
    partner_code: order.partner_code,
    status: order.status,
    subtotal_lkr: Number(order.subtotal_lkr),
    delivery_lkr: Number(order.delivery_lkr),
    total_lkr: Number(order.total_lkr),
    currency: 'LKR',
    destination_type: order.destination_type,
    destination_name: order.destination_name,
    message: order.message,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: (order.items || []).map((item) => ({
      sku: item.sku, name: item.name, category: item.category,
      unit: item.unit, unit_price_lkr: Number(item.unit_price_lkr),
      quantity: item.quantity, line_total_lkr: Number(item.line_total_lkr),
    })),
  };
}
