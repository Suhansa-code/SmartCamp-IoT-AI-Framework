/**
 * Uber Delivery / Uber Direct adapter.
 *
 * Requires an Uber developer account and a commercial Uber Direct agreement
 * (develop.uber.com). Without a server token every call reports NOT_CONFIGURED
 * and the delivery service falls back to the manual workflow — bookings are
 * never silently faked.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'UBER';

export function isConfigured() {
  return Boolean(env.relief.uber.serverToken);
}

async function apiFetch(path, options = {}) {
  const { uber } = env.relief;
  const response = await fetch(`${uber.baseUrl}${path}`, {
    ...options,
    headers: {
      authorization: `Token ${uber.serverToken}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.message || `Uber API responded ${response.status}`), { status: 502 });
  }
  return payload;
}

export async function quote({ pickup, dropoff, parcels = 1 }) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Uber API credentials are not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  }
  const payload = await apiFetch('/deliveries/quote', {
    method: 'POST',
    body: JSON.stringify({
      pickup_address: pickup.address, dropoff_address: dropoff.address,
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      parcel_count: parcels,
    }),
  });
  return {
    provider,
    estimateLkr: payload.fee ? Number(payload.fee) : null,
    etaMinutes: payload.eta || null,
    raw: payload,
  };
}

export async function book({ pickup, dropoff, parcels = 1, reference, note }) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Uber API credentials are not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  }
  const payload = await apiFetch('/deliveries', {
    method: 'POST',
    body: JSON.stringify({
      pickup_address: pickup.address, dropoff_address: dropoff.address,
      pickup_lat: pickup.lat, pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng,
      parcel_count: parcels,
      external_reference: reference,
      customer_note: note || undefined,
    }),
  });
  return {
    provider,
    providerReference: payload.id || payload.trip_id,
    trackingUrl: payload.tracking_url || null,
    status: 'BOOKED',
    raw: payload,
  };
}

/** Maps an Uber webhook status onto our delivery status vocabulary. */
export function mapStatus(uberStatus) {
  const table = {
    preparing: 'BOOKED',
    pickup: 'IN_TRANSIT',
    enroute: 'IN_TRANSIT',
    delivered: 'DELIVERED',
    canceled: 'CANCELLED',
    failed: 'FAILED',
  };
  return table[String(uberStatus || '').toLowerCase()] || null;
}

export function newFallbackReference() {
  return `UBER-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
