/**
 * Manual delivery workflow — always available fallback.
 * Staff record the courier and waybill number by hand; every status change is
 * written to the delivery event log with the actor's identity.
 */
import crypto from 'node:crypto';

export const provider = 'MANUAL';

export function isConfigured() {
  return true;
}

export async function quote({ note } = {}) {
  return {
    provider,
    estimateLkr: null,
    etaMinutes: null,
    notice: 'Manual booking — freight cost is arranged with the courier and recorded by staff.',
    note,
  };
}

export async function book({ manualReference, pickupNote, bookedBy }) {
  if (!manualReference || String(manualReference).trim().length < 3) {
    throw Object.assign(new Error('manualReference (courier + waybill number) is required'), { status: 400 });
  }
  return {
    provider,
    providerReference: `MAN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    manualReference: String(manualReference).trim().slice(0, 120),
    pickupNote: pickupNote ? String(pickupNote).trim().slice(0, 500) : null,
    bookedBy,
    status: 'BOOKED',
  };
}
