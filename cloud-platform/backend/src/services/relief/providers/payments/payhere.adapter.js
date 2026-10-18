/**
 * PayHere adapter — the de-facto Sri Lankan online payment gateway (Visa /
 * Mastercard, eZ Cash, Genie, bank e-banking, etc.).
 *
 * Sandbox mode (default until a merchant account exists): the adapter returns
 * a fake checkout reference and a sandbox "notify" URL pointing at our own
 * webhook so the whole verify → PAID pipeline can be exercised end to end.
 *
 * Live mode implements PayHere's documented notify-hash verification
 * (MD5 of merchant id + order id + amount + currency + hashed secret). The
 * merchant must configure the notify URL in the PayHere dashboard; no card
 * data ever touches this server.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'PAYHERE';

export function isConfigured() {
  return Boolean(env.relief.payhere.merchantId && env.relief.payhere.merchantSecret);
}

export function isLive() {
  return isConfigured() && env.relief.payhere.mode === 'live';
}

/**
 * Builds the redirect payload for the hosted PayHere checkout.
 * Returns { provider, providerReference, redirectUrl, mode, notice }.
 */
export async function createCheckout({ orderReference, amountLkr, donorEmail, itemDescription }) {
  const { payhere } = env.relief;
  if (!isConfigured()) {
    // Sandbox: a deterministic reference the webhook simulator can echo back.
    const providerReference = `PH-SB-${orderReference}`;
    const redirectUrl = `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=sandbox`;
    return {
      provider,
      providerReference,
      redirectUrl,
      mode: 'sandbox',
      itemDescription,
      donorEmail,
    };
  }
  const providerReference = `PH-${orderReference}`;
  // The hosted checkout posts notifications to our notify URL; we never see
  // card details. Redirect the donor there and wait for the signed callback.
  const redirectUrl = `${payhere.baseUrl}/pay?merchant_id=${encodeURIComponent(payhere.merchantId)}`
    + `&return_url=${encodeURIComponent(payhere.returnUrl || `${env.donations.publicUrl}/relief/checkout/result`)}`
    + `&cancel_url=${encodeURIComponent(payhere.cancelUrl || `${env.donations.publicUrl}/relief`)}`
    + `&notify_url=${encodeURIComponent(payhere.notifyUrl || `${env.donations.publicUrl}/api/relief/webhooks/payhere`)}`
    + `&order_id=${encodeURIComponent(providerReference)}`
    + `&amount=${encodeURIComponent(String(amountLkr))}&currency=LKR`
    + `&item_description=${encodeURIComponent(itemDescription || 'SmartCamp relief order')}`
    + `&email=${encodeURIComponent(donorEmail || '')}`;
  return { provider, providerReference, redirectUrl, mode: 'live', itemDescription, donorEmail };
}

function md5(value) {
  return crypto.createHash('md5').update(value).digest('hex');
}

/**
 * Verifies a PayHere notify payload using the documented hash scheme:
 *   MD5( UPPER(merchant_id) + UPPER(order_id) + amount + currency
 *        + MD5(UPPER(merchant_secret)).toUpperCase() ).toUpperCase()
 * Throws { status: 400 } on invalid signature or amount mismatch — callers
 * must never mark a payment verified from an unverified payload.
 */
export function verifyNotify(rawBody) {
  const { payhere } = env.relief;
  if (!isConfigured()) {
    throw Object.assign(new Error('PayHere is not configured'), { status: 503 });
  }
  const params = new URLSearchParams(rawBody.toString('utf8'));
  const orderId = params.get('order_id') || '';
  const amount = params.get('payhere_amount') || '';
  const currency = params.get('payhere_currency') || '';
  const received = (params.get('md5sig') || '').toUpperCase();

  const secretHash = md5(payhere.merchantSecret.toUpperCase()).toUpperCase();
  const expected = md5(
    `${payhere.merchantId.toUpperCase()}${orderId.toUpperCase()}${amount}${currency}${secretHash}`,
  ).toUpperCase();

  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    throw Object.assign(new Error('Invalid PayHere notify signature'), { status: 400 });
  }

  const status = (params.get('status') || '').toUpperCase();
  return {
    provider,
    eventId: `payhere:${orderId}:${status}`,
    providerReference: orderId,
    amountLkr: Number(amount),
    currency,
    // PayHere statuses: 2 = completed, 0/-1 = failed/aborted, -3 = pending.
    verified: status === '2' && currency === 'LKR',
    eventType: status === '2' ? 'payment_completed' : `payment_${status || 'unknown'}`,
    raw: Object.fromEntries(params),
  };
}
