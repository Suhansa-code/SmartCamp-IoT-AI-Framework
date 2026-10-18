/**
 * Delivery service — books Uber / PickMe when configured, otherwise falls
 * back to the manual workflow. Every booking keeps its provider reference
 * (or manual waybill) and status history in relief_deliveries /
 * relief_delivery_events.
 */
import * as repository from '../../data/relief/relief.repository.js';
import * as uber from './providers/delivery/uber.adapter.js';
import * as pickme from './providers/delivery/pickme.adapter.js';
import * as manual from './providers/delivery/manual.adapter.js';
import { transitionStatus } from './order.service.js';
import { audit } from './audit.service.js';

const ADAPTERS = { UBER: uber, PICKME: pickme, MANUAL: manual };

export function listDeliveryProviders() {
  return [
    { key: 'UBER', label: 'Uber Direct', enabled: uber.isConfigured(), mode: uber.isConfigured() ? 'live' : 'unavailable' },
    { key: 'PICKME', label: 'PickMe Flash', enabled: pickme.isConfigured(), mode: pickme.isConfigured() ? 'live' : 'unavailable' },
    { key: 'MANUAL', label: 'Manual courier booking', enabled: true, mode: 'manual' },
  ];
}

/**
 * Quotes a delivery. Tries the requested provider first; when its API is not
 * configured the manual quote is returned with an explicit fallback notice —
 * never a fabricated estimate.
 */
export async function quoteDelivery({ provider: providerKey, pickup, dropoff, parcels }) {
  const adapter = ADAPTERS[providerKey];
  if (!adapter) throw Object.assign(new Error(`Unknown delivery provider: ${providerKey}`), { status: 400 });
  try {
    const quote = await adapter.quote({ pickup, dropoff, parcels });
    return { ...quote, fallback: false };
  } catch (error) {
    if (error.code === 'NOT_CONFIGURED' || error.status === 503) {
      const fallback = await manual.quote({});
      return {
        ...fallback,
        fallback: true,
        requestedProvider: providerKey,
        notice: `${providerKey} API is not configured. Manual booking is available: staff record the courier and waybill number.`,
      };
    }
    throw error;
  }
}

/**
 * Books a delivery for a PAID order. Falls back to MANUAL when the requested
 * provider's API is unavailable. Advances the order to CONFIRMED_WITH_PARTNER
 * → OUT_FOR_DELIVERY as bookings succeed.
 */
export async function bookDelivery({ order, provider: providerKey, pickup, dropoff, parcels, manualReference, pickupNote, staffEmail, req }) {
  if (!['PAID', 'CONFIRMED_WITH_PARTNER'].includes(order.status)) {
    throw Object.assign(new Error('Deliveries can only be booked for paid orders'), { status: 409 });
  }
  const existing = await repository.getDeliveriesByOrder(order.id);
  const active = existing.find((d) => ['REQUESTED', 'QUOTED', 'BOOKED', 'IN_TRANSIT'].includes(d.status));
  if (active) {
    throw Object.assign(new Error(`Order already has an active delivery (${active.id})`), { status: 409 });
  }

  let adapter = ADAPTERS[providerKey];
  if (!adapter) throw Object.assign(new Error(`Unknown delivery provider: ${providerKey}`), { status: 400 });
  let fallbackToManual = false;
  let result;
  try {
    result = await adapter.book({ pickup, dropoff, parcels, reference: order.reference, note: pickupNote, manualReference, bookedBy: staffEmail });
  } catch (error) {
    if (error.code === 'NOT_CONFIGURED' || error.status === 503) {
      adapter = manual;
      fallbackToManual = true;
      result = await manual.book({ manualReference, pickupNote, bookedBy: staffEmail });
    } else {
      throw error;
    }
  }

  const delivery = await repository.createDelivery({
    order_id: order.id,
    provider: adapter.provider,
    status: result.status || 'BOOKED',
    quote_estimate_lkr: result.estimateLkr ?? null,
    provider_reference: result.providerReference,
    tracking_url: result.trackingUrl || null,
    manual_reference: result.manualReference || null,
    pickup_note: result.pickupNote || pickupNote || null,
    booked_by: staffEmail,
    booked_at: new Date().toISOString(),
  });

  if (order.status === 'PAID') {
    await transitionStatus(order.id, 'CONFIRMED_WITH_PARTNER');
    await repository.addDeliveryEvent({
      deliveryId: delivery.id, status: 'BOOKED',
      providerReference: delivery.provider_reference, note: 'Order confirmed with partner', actor: staffEmail,
    });
  }

  await audit(req, 'delivery.booked', 'delivery', delivery.id, {
    provider: delivery.provider, order: order.reference,
    provider_reference: delivery.provider_reference, fallback_to_manual: fallbackToManual,
  });

  return {
    delivery,
    fallbackToManual,
    notice: fallbackToManual
      ? `${providerKey} API is unavailable — booked through the manual workflow. Record the courier waybill to keep tracking accurate.`
      : null,
  };
}

/** Applies a status update (from a provider callback or authorised staff). */
export async function updateDeliveryStatus({ deliveryId, status, providerReference, note, staffEmail, req }) {
  const delivery = await repository.getDeliveryById(deliveryId);
  if (!delivery) throw Object.assign(new Error('Delivery not found'), { status: 404 });
  const updated = await repository.updateDelivery(deliveryId, {
    status,
    ...(providerReference ? { provider_reference: providerReference } : {}),
    ...(status === 'DELIVERED' ? { delivered_at: new Date().toISOString() } : {}),
  });
  await repository.addDeliveryEvent({
    deliveryId, status, providerReference: providerReference || delivery.provider_reference, note, actor: staffEmail,
  });
  const order = await repository.getOrderById(delivery.order_id);
  if (order) {
    if (status === 'IN_TRANSIT' && order.status === 'CONFIRMED_WITH_PARTNER') {
      await transitionStatus(order.id, 'OUT_FOR_DELIVERY');
    } else if (status === 'DELIVERED' && (order.status === 'OUT_FOR_DELIVERY' || order.status === 'CONFIRMED_WITH_PARTNER')) {
      if (order.status === 'CONFIRMED_WITH_PARTNER') await transitionStatus(order.id, 'OUT_FOR_DELIVERY');
      await transitionStatus(order.id, 'DELIVERED');
    }
  }
  await audit(req, 'delivery.status', 'delivery', deliveryId, { status, note: note || null });
  return updated;
}
