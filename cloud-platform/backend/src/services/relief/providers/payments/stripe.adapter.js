/**
 * Stripe adapter — international Visa/Mastercard support for relief orders.
 * Reuses the same Checkout Session + signed-webhook flow already proven for
 * the donations portal (services/donation/payment.service.js) but tags
 * payments with the relief order reference so verification is shared.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'STRIPE';

export function isConfigured() {
  return Boolean(env.relief.stripe.secretKey);
}

function append(params, key, value) {
  if (value !== undefined && value !== null) params.append(key, String(value));
}

export async function createCheckout({ orderReference, amountLkr, donorEmail, itemDescription }) {
  if (!isConfigured()) {
    // No Stripe keys yet: issue our own hosted checkout with a deterministic
    // reference so the signed verify → PAID pipeline still runs end to end.
    const providerReference = `ST-SB-${orderReference}`;
    return {
      provider,
      providerReference,
      redirectUrl: `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=stripe`,
      mode: 'sandbox',
      itemDescription,
      donorEmail,
    };
  }
  const params = new URLSearchParams();
  append(params, 'mode', 'payment');
  append(params, 'success_url', `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=stripe&payment=success`);
  append(params, 'cancel_url', `${env.donations.publicUrl}/relief?payment=cancelled`);
  append(params, 'customer_email', donorEmail);
  append(params, 'client_reference_id', orderReference);
  append(params, 'metadata[relief_order]', orderReference);
  append(params, 'line_items[0][quantity]', 1);
  // Stripe requires integer minor units; LKR has 2 decimals in Stripe's table.
  append(params, 'line_items[0][price_data][currency]', 'lkr');
  append(params, 'line_items[0][price_data][unit_amount]', Math.round(Number(amountLkr) * 100));
  append(params, 'line_items[0][price_data][product_data][name]', itemDescription || 'SmartCamp relief order');

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.relief.stripe.secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': `relief-${orderReference}`,
    },
    body: params,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.message || 'Stripe checkout could not be created'), { status: 502 });
  }
  return {
    provider,
    providerReference: payload.id,
    redirectUrl: payload.url,
    mode: 'live',
    itemDescription,
  };
}

/** Verifies the Stripe-Signature header (HMAC SHA-256, 5-minute tolerance). */
export function verifyWebhook(rawBody, signatureHeader) {
  const secret = env.relief.stripe.webhookSecret;
  if (!secret) throw Object.assign(new Error('Stripe webhook has not been configured'), { status: 503 });
  const fields = Object.fromEntries(String(signatureHeader || '').split(',').map((part) => part.split('=')));
  const timestamp = Number(fields.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw Object.assign(new Error('Expired Stripe webhook'), { status: 400 });
  }
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  const received = fields.v1 || '';
  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    throw Object.assign(new Error('Invalid Stripe webhook signature'), { status: 400 });
  }
  const event = JSON.parse(rawBody.toString('utf8'));
  const session = event.data?.object || {};
  const orderReference = session.client_reference_id || session.metadata?.relief_order || '';
  const amountLkr = session.amount_total != null ? session.amount_total / 100 : Number(session.metadata?.amount_lkr || 0);
  return {
    provider,
    eventId: event.id || `stripe:${session.id}:${event.type}`,
    providerReference: session.id,
    orderReference,
    amountLkr,
    currency: (session.currency || 'lkr').toUpperCase(),
    verified: event.type === 'checkout.session.completed' && session.payment_status === 'paid',
    eventType: event.type,
    raw: event,
  };
}
