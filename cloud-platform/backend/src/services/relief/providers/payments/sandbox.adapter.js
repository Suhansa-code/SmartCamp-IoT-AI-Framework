/**
 * Sandbox payment adapter — local stand-in used until PayHere / bank / LankaQR
 * credentials exist. It issues a predictable provider reference and exposes a
 * signed simulator webhook so the full verify → order-PAID pipeline (including
 * duplicate-event protection) can be exercised in development and tests.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'SANDBOX';

export function isConfigured() {
  return env.relief.providerMode !== 'live';
}

export async function createCheckout({ orderReference, amountLkr, itemDescription }) {
  const providerReference = `SBX-${orderReference}`;
  return {
    provider,
    providerReference,
    redirectUrl: `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=sandbox`,
    mode: 'sandbox',
    notice: 'Review the payment details below, then confirm to complete your order.',
    itemDescription,
  };
}

export function signSimulatorPayload(payload) {
  return crypto.createHmac('sha256', env.relief.sandboxWebhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/** Verifies the sandbox simulator callback (HMAC over the raw JSON body). */
export function verifySimulatorCallback(rawBody, signatureHeader) {
  const expected = crypto.createHmac('sha256', env.relief.sandboxWebhookSecret)
    .update(rawBody)
    .digest('hex');
  const received = String(signatureHeader || '');
  if (received.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    throw Object.assign(new Error('Invalid sandbox webhook signature'), { status: 400 });
  }
  const payload = JSON.parse(rawBody.toString('utf8'));
  const amountLkr = Number(payload.amount_lkr);
  if (!payload.provider_reference || !Number.isFinite(amountLkr)) {
    throw Object.assign(new Error('Sandbox webhook requires provider_reference and amount_lkr'), { status: 400 });
  }
  return {
    provider,
    eventId: payload.event_id || `sandbox:${payload.provider_reference}:${payload.status || 'ok'}`,
    providerReference: payload.provider_reference,
    amountLkr,
    currency: payload.currency || 'LKR',
    verified: payload.status === 'SUCCESS',
    eventType: payload.status === 'SUCCESS' ? 'payment_completed' : 'payment_failed',
    raw: payload,
  };
}
