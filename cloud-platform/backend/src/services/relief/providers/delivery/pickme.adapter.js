/**
 * PickMe delivery adapter (pickme.lk merchant API).
 * PickMe Go / PickMe Flash merchant access requires a direct commercial
 * agreement; there is no self-serve public API. Until credentials are issued
 * every call reports NOT_CONFIGURED and the delivery service falls back to
 * the manual workflow.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'PICKME';

export function isConfigured() {
  return Boolean(env.relief.pickme.apiKey && env.relief.pickme.merchantId);
}

async function apiFetch(path, options = {}) {
  const { pickme } = env.relief;
  const response = await fetch(`${pickme.baseUrl}${path}`, {
    ...options,
    headers: {
      'x-api-key': pickme.apiKey,
      'x-merchant-id': pickme.merchantId,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.message || `PickMe API responded ${response.status}`), { status: 502 });
  }
  return payload;
}

export async function quote({ pickup, dropoff, parcels = 1 }) {
  if (!isConfigured()) {
    throw Object.assign(new Error('PickMe API credentials are not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  }
  const payload = await apiFetch('/delivery/quote', {
    method: 'POST',
    body: JSON.stringify({
      pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
      dropoff: { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng },
      parcels,
    }),
  });
  return {
    provider,
    estimateLkr: payload.fare ? Number(payload.fare) : null,
    etaMinutes: payload.eta_minutes || null,
    raw: payload,
  };
}

export async function book({ pickup, dropoff, parcels = 1, reference, note }) {
  if (!isConfigured()) {
    throw Object.assign(new Error('PickMe API credentials are not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  }
  const payload = await apiFetch('/delivery/book', {
    method: 'POST',
    body: JSON.stringify({
      pickup: { address: pickup.address, lat: pickup.lat, lng: pickup.lng },
      dropoff: { address: dropoff.address, lat: dropoff.lat, lng: dropoff.lng },
      parcels,
      reference,
      remarks: note || undefined,
    }),
  });
  return {
    provider,
    providerReference: payload.job_id || payload.id,
    trackingUrl: payload.tracking_url || null,
    status: 'BOOKED',
    raw: payload,
  };
}

export function mapStatus(pickmeStatus) {
  const table = {
    pending: 'BOOKED',
    assigned: 'BOOKED',
    picked: 'IN_TRANSIT',
    in_transit: 'IN_TRANSIT',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
    failed: 'FAILED',
  };
  return table[String(pickmeStatus || '').toLowerCase()] || null;
}

export function newFallbackReference() {
  return `PM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}
