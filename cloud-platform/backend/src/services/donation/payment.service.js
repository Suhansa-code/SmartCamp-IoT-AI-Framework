import crypto from 'node:crypto';
import { env } from '../../config/env.js';

function append(params, key, value) {
  if (value !== undefined && value !== null) params.append(key, String(value));
}

export async function createCheckout({ donationId, amountMinor, currency, donorEmail, message }) {
  if (!env.donations.stripeSecretKey) {
    throw Object.assign(new Error('Online payments have not been configured'), { status: 503 });
  }
  const params = new URLSearchParams();
  append(params, 'mode', 'payment');
  append(params, 'success_url', `${env.donations.publicUrl}/donate?payment=success&session_id={CHECKOUT_SESSION_ID}`);
  append(params, 'cancel_url', `${env.donations.publicUrl}/donate?payment=cancelled`);
  append(params, 'customer_email', donorEmail);
  append(params, 'client_reference_id', donationId);
  append(params, 'metadata[donation_id]', donationId);
  append(params, 'line_items[0][quantity]', 1);
  append(params, 'line_items[0][price_data][currency]', currency.toLowerCase());
  append(params, 'line_items[0][price_data][unit_amount]', amountMinor);
  append(params, 'line_items[0][price_data][product_data][name]', 'SmartCamp emergency relief donation');
  append(params, 'line_items[0][price_data][product_data][description]', message || 'Support critical camp resources');
  append(params, 'payment_intent_data[metadata][donation_id]', donationId);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.donations.stripeSecretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': donationId,
    },
    body: params,
  });
  const payload = await response.json();
  if (!response.ok) throw Object.assign(new Error(payload.error?.message || 'Payment checkout could not be created'), { status: 502 });
  return payload;
}

export function verifyStripeWebhook(rawBody, signatureHeader) {
  const secret = env.donations.stripeWebhookSecret;
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
  return JSON.parse(rawBody.toString('utf8'));
}
