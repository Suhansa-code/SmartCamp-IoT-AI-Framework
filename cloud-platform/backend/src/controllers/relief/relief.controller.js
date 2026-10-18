/**
 * Relief portal controllers — public portal, staff back-office, webhooks.
 * Validation is explicit; every state change goes through the services.
 */
import * as repository from '../../data/relief/relief.repository.js';
import * as authService from '../../services/relief/auth.service.js';
import { audit } from '../../services/relief/audit.service.js';
import * as catalogueService from '../../services/relief/catalogue.service.js';
import * as orderService from '../../services/relief/order.service.js';
import * as paymentService from '../../services/relief/payment.service.js';
import * as deliveryService from '../../services/relief/delivery.service.js';
import * as receiptService from '../../services/relief/receipt.service.js';
import { listPaymentMethods } from '../../services/relief/providers/payments/index.js';
import * as sandboxAdapter from '../../services/relief/providers/payments/sandbox.adapter.js';
import { env } from '../../config/env.js';

function sendError(res, error, label) {
  if (Number(error.status || error.statusCode) >= 500) {
    console.error(`[Relief] ${label}:`, error);
  }
  const status = error.status || error.statusCode || 400;
  res.status(status).json({ error: error.message || 'Relief request failed' });
}

// ── Public portal ──────────────────────────────────────────────────────────

export async function getPublicConfig(_req, res, next) {
  try {
    const campaigns = await repository.listCampaigns({ activeOnly: true });
    const transparency = await repository.getTransparencySummary();
    res.json({
      campaigns: campaigns.map((c) => ({
        slug: c.slug, title: c.title, description: c.description,
        goal_amount_lkr: Number(c.goal_amount_lkr), status: c.status,
      })),
      transparency,
      payment_methods: listPaymentMethods(),
      delivery_providers: deliveryService.listDeliveryProviders(),
      destinations: orderService.DESTINATIONS,
      guest_checkout: env.relief.guestCheckout,
      provider_mode: env.relief.providerMode,
    });
  } catch (error) {
    sendError(res, error, 'getPublicConfig');
  }
}

export async function getCatalogue(req, res, next) {
  try {
    const catalogues = await catalogueService.getCatalogues({
      partnerCode: req.query.partner || undefined,
      category: req.query.category || undefined,
    });
    res.json({ catalogues });
  } catch (error) {
    sendError(res, error, 'getCatalogue');
  }
}

export async function listMyOrders(req, res, next) {
  try {
    const orders = await repository.getOrdersByDonor(req.donor.id);
    res.json({ orders: orders.map(orderService.publicView) });
  } catch (error) {
    sendError(res, error, 'listMyOrders');
  }
}

export async function getOrderPublic(req, res, next) {
  try {
    const order = await repository.getOrderByReference(String(req.params.reference || '').trim());
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const payments = await repository.listPaymentsByOrder(order.id);
    const deliveries = await repository.getDeliveriesByOrder(order.id);
    const receipt = deliveries[0] ? await repository.getReceiptByDelivery(deliveries[0].id) : null;
    res.json({
      order: orderService.publicView(order),
      payments: payments.map((p) => ({
        provider: p.provider, status: p.status, amount_lkr: Number(p.amount_lkr),
        payer_reference: p.payer_reference, verified_at: p.verified_at, created_at: p.created_at,
      })),
      deliveries: deliveries.map((d) => ({
        id: d.id, provider: d.provider, status: d.status,
        provider_reference: d.provider_reference, manual_reference: d.manual_reference,
        quote_estimate_lkr: d.quote_estimate_lkr == null ? null : Number(d.quote_estimate_lkr),
        booked_at: d.booked_at, delivered_at: d.delivered_at,
      })),
      receipt: receipt ? {
        condition: receipt.condition, received_at: receipt.created_at,
        inventory_applied: receipt.inventory_applied,
      } : null,
    });
  } catch (error) {
    sendError(res, error, 'getOrderPublic');
  }
}

export async function createOrder(req, res, next) {
  try {
    const idempotencyKey = req.get('Idempotency-Key') || req.body?.idempotency_key || null;
    let result;
    if (req.body?.kind === 'MONEY_DONATION') {
      result = await orderService.createDonationOrder({
        donor: req.donor,
        amountLkr: req.body.amount_lkr,
        message: req.body.message,
        idempotencyKey,
      });
    } else {
      result = await orderService.createPurchaseOrder({
        donor: req.donor,
        cart: req.body?.items,
        destinationType: req.body?.destination_type,
        destinationCode: req.body?.destination_code,
        message: req.body?.message,
        idempotencyKey,
      });
    }
    await audit(req, result.idempotentReplay ? 'order.replayed' : 'order.created', 'order', result.order.id, {
      reference: result.order.reference, kind: result.order.kind,
    });
    res.status(result.idempotentReplay ? 200 : 201).json({
      // The internal id is returned only to the creating client so it can start
      // a payment against /orders/:orderId/payment. Public tracking stays keyed
      // by the opaque reference and never exposes the id.
      order: { id: result.order.id, ...orderService.publicView(result.order) },
      idempotent_replay: result.idempotentReplay,
    });
  } catch (error) {
    sendError(res, error, 'createOrder');
  }
}

export async function startPayment(req, res, next) {
  try {
    const order = await repository.getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.donor_google_id !== req.donor.id && req.staff?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your order' });
    }
    const { payment, checkout } = await paymentService.initiatePayment({
      order,
      provider: String(req.body?.provider || '').toUpperCase(),
      req,
    });
    res.status(201).json({
      payment: {
        id: payment.id, provider: payment.provider, status: payment.status,
        amount_lkr: Number(payment.amount_lkr), payer_reference: payment.payer_reference,
      },
      checkout,
    });
  } catch (error) {
    sendError(res, error, 'startPayment');
  }
}

// ── Webhooks (raw body mounted in app.js) ──────────────────────────────────

/**
 * Sandbox-only convenience: signs a payment callback for a pending SANDBOX
 * payment and feeds it through the exact same verify → idempotency → PAID
 * pipeline as a real gateway webhook. Disabled in live mode.
 */
export async function sandboxSimulatePayment(req, res, next) {
  try {
    if (env.relief.providerMode === 'live') {
      return res.status(403).json({ error: 'Sandbox simulation is disabled in live mode' });
    }
    const order = await repository.getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.donor_google_id !== req.donor.id && req.staff?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not your order' });
    }
    const payments = await repository.listPaymentsByOrder(order.id);
    // Any gateway checkout (PayHere, Stripe, …) is left PENDING until its
    // signed callback arrives, so that is the one this endpoint can complete.
    const payment = payments.find((p) => p.status === 'PENDING')
      || payments.find((p) => p.provider === 'SANDBOX' && p.status === 'PENDING');
    if (!payment) return res.status(404).json({ error: 'No pending payment for this order' });

    const payload = {
      event_id: `sbx-sim-${payment.id}`,
      provider_reference: payment.provider_reference,
      amount_lkr: Number(payment.amount_lkr),
      currency: 'LKR',
      status: req.body?.outcome === 'FAIL' ? 'FAILED' : 'SUCCESS',
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = sandboxAdapter.signSimulatorPayload(payload);
    const result = await paymentService.verifyAndProcess('SANDBOX', raw, signature, { req });
    res.json(result);
  } catch (error) {
    sendError(res, error, 'sandboxSimulatePayment');
  }
}

export function webhookHandler(providerKey) {
  return async (req, res, next) => {
    try {
      const signature = providerKey === 'PAYHERE'
        ? req.body // PayHere posts form fields; verification parses the body itself
        : providerKey === 'SANDBOX'
          ? req.get('x-relief-signature')
          : req.get('stripe-signature');
      const result = await paymentService.verifyAndProcess(providerKey, req.body, signature, { req });
      res.json({ received: true, ...result });
    } catch (error) {
      // Invalid signatures are logged but answered without details leaking.
      sendError(res, error, `webhook:${providerKey}`);
    }
  };
}

// ── Staff auth ─────────────────────────────────────────────────────────────

export async function staffLogin(req, res, next) {
  try {
    const { token, user } = await authService.login(req.body?.email, req.body?.password);
    authService.setStaffSessionCookie(res, token);
    res.json({ token, user });
  } catch (error) {
    sendError(res, error, 'staffLogin');
  }
}

export function staffMe(req, res) {
  res.json({ user: req.staff });
}

export function staffLogout(_req, res) {
  authService.clearStaffSessionCookie(res);
  res.status(204).end();
}

// ── Staff back-office ──────────────────────────────────────────────────────

export async function staffDashboard(req, res, next) {
  try {
    const transparency = await repository.getTransparencySummary();
    const [orders, payments, deliveries, requests] = await Promise.all([
      repository.listOrders(req.staff.role === 'PARTNER' ? { partnerCode: req.staff.org_code } : {}),
      repository.listPayments({ limit: 200 }),
      repository.listDeliveries({ limit: 200 }),
      repository.listCampRequests({ status: 'OPEN' }),
    ]);
    res.json({
      role: req.staff.role,
      transparency,
      counts: {
        orders: orders.length,
        awaiting_payment_orders: orders.filter((o) => o.status === 'AWAITING_PAYMENT').length,
        payments_pending_confirmation: payments.filter((p) => p.status === 'AWAITING_CONFIRMATION').length,
        deliveries_in_flight: deliveries.filter((d) => ['BOOKED', 'IN_TRANSIT', 'REQUESTED', 'QUOTED'].includes(d.status)).length,
        open_camp_requests: requests.length,
      },
    });
  } catch (error) {
    sendError(res, error, 'staffDashboard');
  }
}

export async function staffListOrders(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = String(req.query.status).toUpperCase();
    if (req.staff.role === 'PARTNER') filters.partnerCode = req.staff.org_code;
    else if (req.query.partner) filters.partnerCode = String(req.query.partner).toUpperCase();
    const orders = await repository.listOrders(filters);
    res.json({ orders: orders.map((order) => ({ id: order.id, ...orderService.publicView(order) })) });
  } catch (error) {
    sendError(res, error, 'staffListOrders');
  }
}

export async function staffUpdateOrderStatus(req, res, next) {
  try {
    const toStatus = String(req.body?.status || '').toUpperCase();
    const order = await orderService.transitionStatus(req.params.orderId, toStatus);
    await audit(req, 'order.status_changed', 'order', order.id, { to: toStatus });
    res.json({ order: orderService.publicView({ ...order, items: [] }) });
  } catch (error) {
    sendError(res, error, 'staffUpdateOrderStatus');
  }
}

export async function staffListPayments(req, res, next) {
  try {
    const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
    res.json({ payments: await repository.listPayments({ status }) });
  } catch (error) {
    sendError(res, error, 'staffListPayments');
  }
}

export async function staffConfirmPayment(req, res, next) {
  try {
    const result = await paymentService.confirmPaymentManually({
      paymentId: req.params.paymentId,
      staff: req.staff,
      payerReference: req.body?.payer_reference,
      req,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, 'staffConfirmPayment');
  }
}

export async function staffRejectPayment(req, res, next) {
  try {
    const result = await paymentService.rejectPaymentManually({
      paymentId: req.params.paymentId, staff: req.staff, reason: req.body?.reason, req,
    });
    res.json(result);
  } catch (error) {
    sendError(res, error, 'staffRejectPayment');
  }
}

export async function staffQuoteDelivery(req, res, next) {
  try {
    const quote = await deliveryService.quoteDelivery({
      provider: String(req.body?.provider || 'MANUAL').toUpperCase(),
      pickup: req.body?.pickup, dropoff: req.body?.dropoff, parcels: req.body?.parcels,
    });
    res.json(quote);
  } catch (error) {
    sendError(res, error, 'staffQuoteDelivery');
  }
}

export async function staffBookDelivery(req, res, next) {
  try {
    const order = await repository.getOrderById(req.body?.order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const result = await deliveryService.bookDelivery({
      order,
      provider: String(req.body?.provider || 'MANUAL').toUpperCase(),
      pickup: req.body?.pickup,
      dropoff: req.body?.dropoff,
      parcels: req.body?.parcels,
      manualReference: req.body?.manual_reference,
      pickupNote: req.body?.pickup_note,
      staffEmail: req.staff.email,
      req,
    });
    res.status(201).json(result);
  } catch (error) {
    sendError(res, error, 'staffBookDelivery');
  }
}

export async function staffListDeliveries(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = String(req.query.status).toUpperCase();
    if (req.query.provider) filters.provider = String(req.query.provider).toUpperCase();
    res.json({ deliveries: await repository.listDeliveries(filters) });
  } catch (error) {
    sendError(res, error, 'staffListDeliveries');
  }
}

export async function staffUpdateDeliveryStatus(req, res, next) {
  try {
    const delivery = await deliveryService.updateDeliveryStatus({
      deliveryId: req.params.deliveryId,
      status: String(req.body?.status || '').toUpperCase(),
      providerReference: req.body?.provider_reference,
      note: req.body?.note,
      staffEmail: req.staff.email,
      req,
    });
    res.json({ delivery });
  } catch (error) {
    sendError(res, error, 'staffUpdateDeliveryStatus');
  }
}

export async function staffConfirmReceipt(req, res, next) {
  try {
    const result = await receiptService.confirmReceipt({
      deliveryId: req.body?.delivery_id,
      staff: req.staff,
      condition: req.body?.condition,
      lines: req.body?.lines,
      notes: req.body?.notes,
      req,
    });
    res.status(result.alreadyReceived ? 200 : 201).json(result);
  } catch (error) {
    sendError(res, error, 'staffConfirmReceipt');
  }
}

export async function createCampRequest(req, res, next) {
  try {
    const body = req.body || {};
    const resourceName = String(body.resource_name || '').trim().slice(0, 120);
    const quantity = Number(body.quantity);
    const unit = String(body.unit || '').trim().slice(0, 30);
    const category = String(body.category || '').toLowerCase();
    const campId = String(body.camp_id || req.staff?.org_code || '').trim();
    if (!resourceName || !campId || !unit || !['food', 'water', 'medical', 'hygiene', 'shelter', 'other'].includes(category)
        || !Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'resource_name, camp_id, category, quantity (>0) and unit are required' });
    }
    const request = await repository.createCampRequest({
      camp_id: campId,
      requested_by: req.staff?.email || req.donor?.email || 'anonymous',
      resource_name: resourceName, category, quantity, unit,
      priority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(String(body.priority).toUpperCase())
        ? String(body.priority).toUpperCase() : 'NORMAL',
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
    });
    await audit(req, 'camp_request.created', 'camp_request', request.id, { camp_id: campId, resource: resourceName });
    res.status(201).json({ request });
  } catch (error) {
    sendError(res, error, 'createCampRequest');
  }
}

export async function listCampRequests(req, res, next) {
  try {
    const filters = {};
    if (req.query.status) filters.status = String(req.query.status).toUpperCase();
    if (req.staff?.role === 'CAMP_MANAGER') filters.campId = req.staff.org_code;
    else if (req.query.camp_id) filters.campId = String(req.query.camp_id);
    res.json({ requests: await repository.listCampRequests(filters) });
  } catch (error) {
    sendError(res, error, 'listCampRequests');
  }
}

export async function updateCampRequest(req, res, next) {
  try {
    const status = String(req.body?.status || '').toUpperCase();
    if (!['OPEN', 'APPROVED', 'ORDERED', 'FULFILLED', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const request = await repository.getCampRequestById(req.params.requestId);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    const updated = await repository.updateCampRequestStatus(request.id, status);
    await audit(req, 'camp_request.status', 'camp_request', request.id, { to: status });
    res.json({ request: updated });
  } catch (error) {
    sendError(res, error, 'updateCampRequest');
  }
}

export async function staffAuditLog(req, res, next) {
  try {
    const action = req.query.action ? String(req.query.action) : undefined;
    res.json({ entries: await repository.listAudit({ action, limit: 200 }) });
  } catch (error) {
    sendError(res, error, 'staffAuditLog');
  }
}
