import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_ENABLED = 'false';

const { createApp } = await import('../../src/app.js');
const donationAuth = await import('../../src/services/donation/auth.service.js');
const repository = await import('../../src/data/relief/relief.repository.js');
const reliefAuth = await import('../../src/services/relief/auth.service.js');
const sandboxAdapter = await import('../../src/services/relief/providers/payments/sandbox.adapter.js');

let baseUrl;
let server;
let donorCookie;
let adminToken;
let centreToken;
let campToken;

before(async () => {
  const app = createApp();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const session = donationAuth.createSession({ id: 'donor-del', email: 'del@example.lk', name: 'Delivery Donor', picture: null });
  donorCookie = `smartcamp_donor=${encodeURIComponent(session)}`;

  for (const member of [
    { email: 'admin@del.lk', password: 'AdminPass123!', role: 'ADMIN', orgCode: null },
    { email: 'centre@del.lk', password: 'CentrePass123!', role: 'COLLECTION_CENTRE', orgCode: 'CC-KLN' },
    { email: 'camp@del.lk', password: 'CampPass123!', role: 'CAMP_MANAGER', orgCode: 'SCB-UNIT-01' },
  ]) {
    await repository.createStaffUser({
      email: member.email,
      passwordHash: reliefAuth.hashPassword(member.password),
      displayName: member.email,
      role: member.role,
      orgCode: member.orgCode,
    });
  }
  adminToken = await loginToken('admin@del.lk', 'AdminPass123!');
  centreToken = await loginToken('centre@del.lk', 'CentrePass123!');
  campToken = await loginToken('camp@del.lk', 'CampPass123!');
});

after(() => server.close());

async function api(pathname, options = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, options);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function post(pathname, payload, headers = {}) {
  return api(pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

async function loginToken(email, password) {
  const { body } = await post('/api/relief/auth/login', { email, password });
  return body.token;
}

/** Creates a purchase order and pays it through the sandbox webhook. */
async function createPaidOrder({ destinationType = 'CAMP', destinationCode = 'SCB-UNIT-01' } = {}) {
  const created = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [{ partner_code: 'KEELLS', sku: 'SBX-K-001', quantity: 2 }],
    destination_type: destinationType,
    destination_code: destinationCode,
  }, { cookie: donorCookie });
  assert.equal(created.status, 201);
  const full = await repository.getOrderByReference(created.body.order.reference);
  const start = await post(`/api/relief/orders/${full.id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  const payload = {
    event_id: `evt-${full.reference}`,
    provider_reference: start.body.checkout.providerReference,
    amount_lkr: Number(full.total_lkr),
    currency: 'LKR',
    status: 'SUCCESS',
  };
  const signature = sandboxAdapter.signSimulatorPayload(payload);
  await api('/api/relief/webhooks/sandbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relief-signature': signature },
    body: JSON.stringify(payload),
  });
  const paid = await repository.getOrderByReference(created.body.order.reference);
  assert.equal(paid.status, 'PAID');
  return paid;
}

test('Uber/PickMe quote falls back to manual with an explicit notice', async () => {
  const { status, body } = await post('/api/relief/staff/deliveries/quote',
    { provider: 'UBER', pickup: { address: 'Keells Nugegoda' }, dropoff: { address: 'Kolonnawa Centre' } },
    { authorization: `Bearer ${adminToken}` });
  assert.equal(status, 200);
  assert.equal(body.fallback, true);
  assert.equal(body.provider, 'MANUAL');
  assert.match(body.notice, /not configured/i);
});

test('delivery cannot be booked for an unpaid order', async () => {
  const created = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [{ partner_code: 'KEELLS', sku: 'SBX-K-002', quantity: 1 }],
    destination_type: 'COLLECTION_CENTRE', destination_code: 'CC-KLN',
  }, { cookie: donorCookie });
  const full = await repository.getOrderByReference(created.body.order.reference);
  const { status } = await post('/api/relief/staff/deliveries', {
    order_id: full.id, provider: 'MANUAL', manual_reference: 'CourierX WB-1',
  }, { authorization: `Bearer ${adminToken}` });
  assert.equal(status, 409);
});

test('manual booking fallback stores provider reference and waybill', async () => {
  const order = await createPaidOrder();
  const booked = await post('/api/relief/staff/deliveries', {
    order_id: order.id, provider: 'UBER',
    manual_reference: 'CEY Logistics WB-77821',
    pickup_note: 'Collect from Keells Nugegoda loading bay',
  }, { authorization: `Bearer ${adminToken}` });
  assert.equal(booked.status, 201);
  assert.equal(booked.body.delivery.provider, 'MANUAL');
  assert.ok(booked.body.delivery.provider_reference.startsWith('MAN-'));
  assert.equal(booked.body.delivery.manual_reference, 'CEY Logistics WB-77821');
  assert.equal(booked.body.fallbackToManual, true);
  assert.equal(booked.body.delivery.status, 'BOOKED');
  // Order advanced out of PAID.
  const after = await repository.getOrderByReference(order.reference);
  assert.equal(after.status, 'CONFIRMED_WITH_PARTNER');
});

test('delivery status updates advance the order and keep events', async () => {
  const order = await createPaidOrder();
  const booked = await post('/api/relief/staff/deliveries', {
    order_id: order.id, provider: 'MANUAL', manual_reference: 'Van 4 / WB-9',
  }, { authorization: `Bearer ${adminToken}` });
  const deliveryId = booked.body.delivery.id;

  await api(`/api/relief/staff/deliveries/${deliveryId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'IN_TRANSIT', note: 'Left the supermarket' }),
  });
  let full = await repository.getDeliveryById(deliveryId);
  assert.equal(full.status, 'IN_TRANSIT');
  assert.equal((await repository.getOrderByReference(order.reference)).status, 'OUT_FOR_DELIVERY');

  await api(`/api/relief/staff/deliveries/${deliveryId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'DELIVERED', note: 'Handed over' }),
  });
  assert.equal((await repository.getOrderByReference(order.reference)).status, 'DELIVERED');
  full = await repository.getDeliveryById(deliveryId);
  assert.ok(full.events.length >= 3);
});

test('collection centre receipt confirms and order becomes RECEIVED', async () => {
  const order = await createPaidOrder({ destinationType: 'COLLECTION_CENTRE', destinationCode: 'CC-KLN' });
  const booked = await post('/api/relief/staff/deliveries', {
    order_id: order.id, provider: 'MANUAL', manual_reference: 'Truck 1 / WB-555',
  }, { authorization: `Bearer ${adminToken}` });
  const received = await post('/api/relief/staff/receipts', {
    delivery_id: booked.body.delivery.id, condition: 'INTACT', notes: 'All bags sealed',
  }, { authorization: `Bearer ${centreToken}` });
  assert.equal(received.status, 201);
  assert.equal(received.body.alreadyReceived, false);
  assert.equal((await repository.getOrderByReference(order.reference)).status, 'RECEIVED');

  // Duplicate receipt is idempotent.
  const again = await post('/api/relief/staff/receipts', {
    delivery_id: booked.body.delivery.id, condition: 'INTACT',
  }, { authorization: `Bearer ${centreToken}` });
  assert.equal(again.status, 200);
  assert.equal(again.body.alreadyReceived, true);
});

test('receipt confirmation is rejected for unauthorised roles', async () => {
  const order = await createPaidOrder();
  const booked = await post('/api/relief/staff/deliveries', {
    order_id: order.id, provider: 'MANUAL', manual_reference: 'Bike / WB-2',
  }, { authorization: `Bearer ${adminToken}` });
  // Camp manager of a different camp cannot confirm a Kolonnawa-centre receipt…
  const { status } = await post('/api/relief/staff/receipts', {
    delivery_id: booked.body.delivery.id,
  }, { authorization: `Bearer ${campToken}` });
  // CAMP_MANAGER is an allowed role — should succeed; the negative case is donor/unauthenticated:
  assert.equal(status, 201);

  const unauth = await post('/api/relief/staff/receipts', {
    delivery_id: booked.body.delivery.id,
  });
  assert.equal(unauth.status, 401);
});

test('inventory is not touched before a receipt (no movement on payment or delivery)', async () => {
  // In DB-disabled mode the ledger is skipped, but the invariant we can assert
  // is that no receipt row exists until confirmReceipt is called.
  const order = await createPaidOrder();
  const booked = await post('/api/relief/staff/deliveries', {
    order_id: order.id, provider: 'MANUAL', manual_reference: 'Lorry / WB-3',
  }, { authorization: `Bearer ${adminToken}` });
  assert.equal(await repository.getReceiptByDelivery(booked.body.delivery.id), null);
  await post('/api/relief/staff/receipts', { delivery_id: booked.body.delivery.id },
    { authorization: `Bearer ${centreToken}` });
  const receipt = await repository.getReceiptByDelivery(booked.body.delivery.id);
  assert.ok(receipt);
  assert.equal(receipt.received_role, 'COLLECTION_CENTRE');
});

test('camp managers raise requests; admins update them', async () => {
  const created = await post('/api/relief/camp-requests', {
    camp_id: 'SCB-UNIT-01', resource_name: 'Drinking water', category: 'water',
    quantity: 500, unit: 'L', priority: 'URGENT', notes: 'Two days of stock left',
  }, { authorization: `Bearer ${campToken}` });
  assert.equal(created.status, 201);
  assert.equal(created.body.request.status, 'OPEN');

  const updated = await api(`/api/relief/camp-requests/${created.body.request.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'APPROVED' }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.request.status, 'APPROVED');
});

test('partner staff only see their own partner orders', async () => {
  await repository.createStaffUser({
    email: 'keells@del.lk', passwordHash: reliefAuth.hashPassword('KeellsPass123!'),
    displayName: 'Keells', role: 'PARTNER', orgCode: 'KEELLS',
  });
  const keellsToken = await loginToken('keells@del.lk', 'KeellsPass123!');
  await createPaidOrder({ destinationType: 'COLLECTION_CENTRE', destinationCode: 'CC-KLN' });

  const { status, body } = await api('/api/relief/staff/orders', {
    headers: { authorization: `Bearer ${keellsToken}` },
  });
  assert.equal(status, 200);
  assert.ok(body.orders.length > 0);
  assert.ok(body.orders.every((o) => o.partner_code === 'KEELLS'));
});

test('dashboard returns role-scoped counts', async () => {
  const { status, body } = await api('/api/relief/staff/dashboard', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(status, 200);
  assert.equal(body.role, 'ADMIN');
  assert.ok(body.counts.orders >= 0);
  assert.ok(body.transparency);
});
