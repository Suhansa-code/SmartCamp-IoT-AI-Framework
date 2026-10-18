/**
 * Payment service — the only path to PAID.
 *
 * Invariants enforced here (and covered by tests):
 *  1. An order can only become PAID after a payment row reaches VERIFIED.
 *  2. A payment only reaches VERIFIED via a signature-verified webhook or an
 *     authorised staff confirmation (ADMIN role) — never from client input.
 *  3. Duplicate webhook deliveries (same event_id) are recorded once and
 *     acknowledged without re-processing.
 *  4. Verified amounts must match the order total (LKR); mismatches are
 *     flagged and do NOT flip the order.
 */
import * as repository from '../../data/relief/relief.repository.js';
import { getPaymentAdapter } from './providers/payments/index.js';
import * as payhere from './providers/payments/payhere.adapter.js';
import * as stripe from './providers/payments/stripe.adapter.js';
import * as sandbox from './providers/payments/sandbox.adapter.js';
import { transitionStatus } from './order.service.js';
import { audit } from './audit.service.js';
import { env } from '../../config/env.js';

const WEBHOOK_PROVIDERS = { PAYHERE: payhere, STRIPE: stripe, SANDBOX: sandbox };

/**
 * Starts a payment for an order. Returns { payment, checkout } where checkout
 * carries redirectUrl + provider-specific instructions.
 */
export async function initiatePayment({ order, provider: providerKey, req }) {
  if (['PAID', 'CANCELLED', 'EXPIRED', 'RECEIVED', 'DELIVERED', 'OUT_FOR_DELIVERY', 'CONFIRMED_WITH_PARTNER'].includes(order.status)) {
    throw Object.assign(new Error(`Order is already ${order.status}`), { status: 409 });
  }
  const adapter = getPaymentAdapter(providerKey);
  // Credentials are only mandatory in live mode. Outside it each gateway
  // adapter issues its own hosted checkout so the full flow still runs.
  if (!adapter.isConfigured() && env.relief.providerMode === 'live') {
    throw Object.assign(new Error(`Payment provider ${providerKey} is not configured`), { status: 503 });
  }

  const existing = await repository.listPaymentsByOrder(order.id);
  const active = existing.find((p) => ['PENDING', 'AWAITING_CONFIRMATION'].includes(p.status)
    && p.provider === adapter.provider);
  if (active) {
    // Reuse the pending payment rather than creating a duplicate attempt.
    const checkout = await adapter.createCheckout({
      orderReference: order.reference,
      amountLkr: Number(order.total_lkr),
      donorEmail: order.donor_email,
      itemDescription: `SmartCamp relief order ${order.reference}`,
    });
    return { payment: active, checkout };
  }

  // The donor switched methods: retire the attempts that can no longer be
  // completed so only the method they picked now is outstanding.
  for (const stale of existing.filter((p) => ['PENDING', 'AWAITING_CONFIRMATION'].includes(p.status))) {
    await repository.updatePaymentStatus(stale.id, 'CANCELLED');
  }

  const payment = await repository.createPayment({
    order_id: order.id,
    provider: adapter.provider,
    status: adapter.provider === 'BANK_TRANSFER' || adapter.provider === 'LANKAQR'
      ? 'AWAITING_CONFIRMATION' : 'PENDING',
    amount_lkr: Number(order.total_lkr),
  });
  const checkout = await adapter.createCheckout({
    orderReference: order.reference,
    amountLkr: Number(order.total_lkr),
    donorEmail: order.donor_email,
    itemDescription: `SmartCamp relief order ${order.reference}`,
  });
  if (checkout.providerReference) {
    await repository.updatePaymentStatus(payment.id, payment.status, { providerReference: checkout.providerReference });
  }
  if (order.status === 'CREATED') {
    await transitionStatus(order.id, 'AWAITING_PAYMENT');
  }
  await audit(req, 'payment.initiated', 'payment', payment.id, {
    provider: adapter.provider, order: order.reference, amount_lkr: Number(order.total_lkr),
  });
  const refreshed = await repository.getPaymentById(payment.id);
  return { payment: refreshed, checkout };
}

/** Marks the order PAID once its payment is VERIFIED (amount must match). */
async function promoteOrderFromVerifiedPayment(payment, { actor, req }) {
  const order = await repository.getOrderById(payment.order_id);
  if (!order) return { promoted: false, reason: 'order_missing' };
  if (order.status === 'PAID' || order.status === 'CONFIRMED_WITH_PARTNER'
      || order.status === 'OUT_FOR_DELIVERY' || order.status === 'DELIVERED' || order.status === 'RECEIVED') {
    return { promoted: false, reason: 'already_paid', order };
  }
  const paid = Math.abs(Number(payment.amount_lkr) - Number(order.total_lkr)) < 0.01;
  if (!paid) {
    await audit(req || { staff: { email: actor || 'system', role: 'SYSTEM' } },
      'payment.amount_mismatch', 'order', order.id,
      { expected: Number(order.total_lkr), received: Number(payment.amount_lkr) });
    return { promoted: false, reason: 'amount_mismatch', order };
  }
  await repository.updateOrderStatus(order.id, 'PAID');
  await audit(req || { staff: { email: actor || 'system', role: 'SYSTEM' } },
    'order.paid', 'order', order.id, { reference: order.reference, payment_id: payment.id });
  return { promoted: true, order: await repository.getOrderById(order.id) };
}

/**
 * Processes a verified webhook payload (already signature-checked by the
 * adapter). Duplicate event IDs are acknowledged without side effects.
 */
export async function processVerifiedWebhook(payload, { req } = {}) {
  const { duplicate, event } = await repository.recordPaymentEvent({
    event_id: payload.eventId,
    provider: payload.provider,
    event_type: payload.eventType,
    payload: payload.raw,
    signature_ok: true,
  });
  if (duplicate) {
    return { duplicate: true, processed: event.process_result || 'ignored' };
  }

  let payment = await repository.getPaymentByProviderReference(payload.providerReference);
  if (!payment && payload.orderReference) {
    const order = await repository.getOrderByReference(payload.orderReference);
    if (order) payment = (await repository.listPaymentsByOrder(order.id))[0] || null;
  }
  if (!payment) {
    await repository.updatePaymentEventResult(payload.eventId, 'no_matching_payment');
    return { duplicate: false, processed: 'no_matching_payment' };
  }
  if (payment.status === 'VERIFIED') {
    await repository.updatePaymentEventResult(payload.eventId, 'already_verified');
    return { duplicate: false, processed: 'already_verified', paymentId: payment.id };
  }

  if (!payload.verified) {
    await repository.updatePaymentStatus(payment.id, 'FAILED', { providerReference: payload.providerReference });
    await repository.updatePaymentEventResult(payload.eventId, 'marked_failed');
    return { duplicate: false, processed: 'marked_failed', paymentId: payment.id };
  }

  if (Math.abs(Number(payload.amountLkr) - Number(payment.amount_lkr)) >= 0.01 || payload.currency !== 'LKR') {
    await repository.updatePaymentEventResult(payload.eventId, 'amount_or_currency_mismatch');
    await audit(req || { staff: { email: 'system', role: 'SYSTEM' } }, 'payment.webhook_mismatch',
      'payment', payment.id, { expected: Number(payment.amount_lkr), received: payload.amountLkr });
    return { duplicate: false, processed: 'amount_or_currency_mismatch', paymentId: payment.id };
  }

  payment = await repository.markPaymentVerified(payment.id, {
    verifiedBy: `webhook:${payload.provider}`,
    providerReference: payload.providerReference,
  });
  const promotion = await promoteOrderFromVerifiedPayment(payment, { req });
  await repository.updatePaymentEventResult(payload.eventId, promotion.promoted ? 'order_paid' : promotion.reason);
  return { duplicate: false, processed: promotion.promoted ? 'order_paid' : promotion.reason, paymentId: payment.id };
}

/** Signature-verifying entry point used by the webhook controllers. */
export function verifyAndProcess(providerKey, rawBody, signatureHeader, { req } = {}) {
  const adapter = WEBHOOK_PROVIDERS[providerKey];
  if (!adapter) {
    throw Object.assign(new Error(`Unknown webhook provider: ${providerKey}`), { status: 404 });
  }
  const payload = providerKey === 'SANDBOX'
    ? sandbox.verifySimulatorCallback(rawBody, signatureHeader)
    : providerKey === 'PAYHERE'
      ? payhere.verifyNotify(rawBody)
      : stripe.verifyWebhook(rawBody, signatureHeader);
  return processVerifiedWebhook(payload, { req });
}

/** Staff confirmation for manual methods (bank transfer / LankaQR). */
export async function confirmPaymentManually({ paymentId, staff, payerReference, req }) {
  const payment = await repository.getPaymentById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.status === 'VERIFIED') return { payment, alreadyVerified: true };
  if (!['BANK_TRANSFER', 'LANKAQR', 'SANDBOX'].includes(payment.provider)) {
    throw Object.assign(new Error('Only manual payment methods can be confirmed by staff'), { status: 400 });
  }
  const verified = await repository.markPaymentVerified(payment.id, {
    verifiedBy: staff.email,
    providerReference: payment.provider_reference,
  });
  if (payerReference) {
    await repository.updatePaymentStatus(payment.id, 'VERIFIED', { payerReference: String(payerReference).slice(0, 80) });
  }
  const promotion = await promoteOrderFromVerifiedPayment(verified, { actor: staff.email, req });
  await audit(req, 'payment.confirmed_manual', 'payment', payment.id, {
    provider: payment.provider, order_reference: promotion.order?.reference, payer_reference: payerReference,
  });
  const refreshed = await repository.getPaymentById(payment.id);
  return { payment: refreshed, alreadyVerified: false, orderPromoted: promotion.promoted };
}

/** Staff rejection of a manual payment (e.g. bad slip). */
export async function rejectPaymentManually({ paymentId, staff, reason, req }) {
  const payment = await repository.getPaymentById(paymentId);
  if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404 });
  if (payment.status === 'VERIFIED') {
    throw Object.assign(new Error('A verified payment cannot be rejected'), { status: 409 });
  }
  const updated = await repository.updatePaymentStatus(payment.id, 'FAILED');
  await audit(req, 'payment.rejected_manual', 'payment', payment.id, { reason: reason || null });
  return { payment: updated };
}
