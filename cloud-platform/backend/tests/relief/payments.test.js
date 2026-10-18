import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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

before(async () => {
  const app = createApp();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const session = donationAuth.createSession({ id: 'donor-pay', email: 'pay@example.lk', name: 'Pay Donor', picture: null });
  donorCookie = `smartcamp_donor=${encodeURIComponent(session)}`;

  await repository.createStaffUser({
    email: 'admin@test.lk',
    passwordHash: reliefAuth.hashPassword('AdminPass123!'),
    displayName: 'Test Admin',
    role: 'ADMIN',
  });
  const login = await fetch(`${baseUrl}/api/relief/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.lk', password: 'AdminPass123!' }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 200);
  adminToken = loginBody.token;
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

async function createDonationOrder(amountLkr = 1500) {
  const { status, body } = await post('/api/relief/orders', { kind: 'MONEY_DONATION', amount_lkr: amountLkr }, { cookie: donorCookie });
  assert.equal(status, 201);
  return body.order;
}

test('staff login rejects bad credentials', async () => {
  const { status } = await post('/api/relief/auth/login', { email: 'admin@test.lk', password: 'wrong' });
  assert.equal(status, 401);
});

test('sandbox webhook marks payment VERIFIED and order PAID', async () => {
  const order = await createDonationOrder(2500);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  assert.equal(start.status, 201);
  assert.equal(start.body.payment.status, 'PENDING');
  const providerReference = start.body.checkout.providerReference;

  const payload = {
    event_id: `evt-${providerReference}-1`,
    provider_reference: providerReference,
    amount_lkr: 2500,
    currency: 'LKR',
    status: 'SUCCESS',
  };
  const raw = JSON.stringify(payload);
  const signature = sandboxAdapter.signSimulatorPayload(payload);
  const first = await api('/api/relief/webhooks/sandbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relief-signature': signature },
    body: raw,
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.duplicate, false);
  assert.equal(first.body.processed, 'order_paid');

  const tracked = await getOrder(order.reference);
  assert.equal(tracked.status, 'PAID');
});

test('duplicate webhook deliveries do not create duplicate payments or re-process', async () => {
  const order = await createDonationOrder(1200);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  const providerReference = start.body.checkout.providerReference;
  const payload = {
    event_id: 'evt-duplicate-test',
    provider_reference: providerReference,
    amount_lkr: 1200,
    currency: 'LKR',
    status: 'SUCCESS',
  };
  const raw = JSON.stringify(payload);
  const signature = sandboxAdapter.signSimulatorPayload(payload);
  const headers = { 'content-type': 'application/json', 'x-relief-signature': signature };
  const first = await api('/api/relief/webhooks/sandbox', { method: 'POST', headers, body: raw });
  assert.equal(first.body.processed, 'order_paid');
  const replay = await api('/api/relief/webhooks/sandbox', { method: 'POST', headers, body: raw });
  assert.equal(replay.status, 200);
  assert.equal(replay.body.duplicate, true);

  const payments = await repository.listPaymentsByOrder((await repoOrder(order.reference)).id);
  assert.equal(payments.filter((p) => p.status === 'VERIFIED').length, 1);
});

test('invalid webhook signature is rejected', async () => {
  const order = await createDonationOrder(900);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  const { status } = await api('/api/relief/webhooks/sandbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relief-signature': 'deadbeef' },
    body: JSON.stringify({
      event_id: 'evt-bad-sig', provider_reference: start.body.checkout.providerReference,
      amount_lkr: 900, currency: 'LKR', status: 'SUCCESS',
    }),
  });
  assert.equal(status, 400);
  const tracked = await getOrder(order.reference);
  assert.notEqual(tracked.status, 'PAID');
});

test('amount mismatch does not flip the order to PAID', async () => {
  const order = await createDonationOrder(3000);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  const providerReference = start.body.checkout.providerReference;
  const payload = {
    event_id: 'evt-amount-mismatch',
    provider_reference: providerReference,
    amount_lkr: 1, // short-change attempt
    currency: 'LKR',
    status: 'SUCCESS',
  };
  const signature = sandboxAdapter.signSimulatorPayload(payload);
  const result = await api('/api/relief/webhooks/sandbox', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-relief-signature': signature },
    body: JSON.stringify(payload),
  });
  assert.equal(result.body.processed, 'amount_or_currency_mismatch');
  const tracked = await getOrder(order.reference);
  assert.notEqual(tracked.status, 'PAID');
  const payments = await repository.listPaymentsByOrder(tracked.id);
  assert.equal(payments.every((p) => p.status !== 'VERIFIED'), true);
});

test('bank transfer stays AWAITING_CONFIRMATION until staff confirms, then order is PAID', async () => {
  const order = await createDonationOrder(4000);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'BANK_TRANSFER' }, { cookie: donorCookie });
  assert.equal(start.status, 201);
  assert.equal(start.body.payment.status, 'AWAITING_CONFIRMATION');
  assert.ok(start.body.checkout.instructions.reference);

  // Not paid yet.
  assert.notEqual((await getOrder(order.reference)).status, 'PAID');

  const confirmed = await post(`/api/relief/staff/payments/${start.body.payment.id}/confirm`,
    { payer_reference: 'SLIP-9981' }, { authorization: `Bearer ${adminToken}` });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.payment.status, 'VERIFIED');
  assert.equal(confirmed.body.orderPromoted, true);
  assert.equal((await getOrder(order.reference)).status, 'PAID');
});

test('non-admin staff cannot confirm manual payments', async () => {
  await repository.createStaffUser({
    email: 'centre@test.lk',
    passwordHash: reliefAuth.hashPassword('CentrePass123!'),
    displayName: 'Centre',
    role: 'COLLECTION_CENTRE',
    orgCode: 'CC-KLN',
  });
  const order = await createDonationOrder(700);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'LANKAQR' }, { cookie: donorCookie });
  const { status } = await post(`/api/relief/staff/payments/${start.body.payment.id}/confirm`,
    {}, { authorization: 'Bearer ' + (await loginToken('centre@test.lk', 'CentrePass123!')) });
  assert.equal(status, 403);
});

test('LankaQR payment waits for manual confirmation and records the payer reference', async () => {
  const order = await createDonationOrder(1800);
  const start = await post(`/api/relief/orders/${(await repoOrder(order.reference)).id}/payment`, { provider: 'LANKAQR' }, { cookie: donorCookie });
  assert.equal(start.body.payment.status, 'AWAITING_CONFIRMATION');
  assert.ok(start.body.checkout.instructions.qrPayload);
  const confirmed = await post(`/api/relief/staff/payments/${start.body.payment.id}/confirm`,
    { payer_reference: 'LR-889911' }, { authorization: `Bearer ${adminToken}` });
  assert.equal(confirmed.body.payment.status, 'VERIFIED');
  assert.equal(confirmed.body.payment.payer_reference, 'LR-889911');
});

test('sandbox simulate endpoint drives the same verify pipeline to PAID and is idempotent', async () => {
  const order = await createDonationOrder(3300);
  const full = await repository.getOrderByReference(order.reference);
  await post(`/api/relief/orders/${full.id}/payment`, { provider: 'SANDBOX' }, { cookie: donorCookie });
  const first = await post(`/api/relief/orders/${full.id}/sandbox/pay`, {}, { cookie: donorCookie });
  assert.equal(first.status, 200);
  assert.equal(first.body.processed, 'order_paid');
  assert.equal((await repository.getOrderByReference(order.reference)).status, 'PAID');

  // Re-running the simulator uses the same event id and is a no-op.
  const replay = await post(`/api/relief/orders/${full.id}/sandbox/pay`, {}, { cookie: donorCookie });
  assert.equal(replay.status, 404); // no pending sandbox payment left
});

test('guest identity is preserved through order creation and payment', async () => {
  const guestHeaders = { 'x-relief-guest': 'guest-browser-session' };
  const created = await post('/api/relief/orders', {
    kind: 'MONEY_DONATION', amount_lkr: 1100,
  }, guestHeaders);
  assert.equal(created.status, 201);

  const started = await post(`/api/relief/orders/${created.body.order.id}/payment`, {
    provider: 'PAYHERE',
  }, guestHeaders);
  assert.equal(started.status, 201);

  const wrongGuest = await post(`/api/relief/orders/${created.body.order.id}/sandbox/pay`, {}, {
    'x-relief-guest': 'different-browser-session',
  });
  assert.equal(wrongGuest.status, 403);

  const completed = await post(`/api/relief/orders/${created.body.order.id}/sandbox/pay`, {}, guestHeaders);
  assert.equal(completed.status, 200);
  assert.equal(completed.body.processed, 'order_paid');
});

test('a gateway checkout (PayHere) can be started and completed end to end', async () => {
  const order = await createDonationOrder(2200);
  const full = await repoOrder(order.reference);
  const start = await post(`/api/relief/orders/${full.id}/payment`, { provider: 'PAYHERE' }, { cookie: donorCookie });
  assert.equal(start.status, 201);
  assert.equal(start.body.payment.provider, 'PAYHERE');
  assert.equal(start.body.payment.status, 'PENDING');
  assert.ok(start.body.checkout.redirectUrl);
  // Copy a donor actually reads must never describe the flow as a mock/demo.
  const { payment_methods: methods } = await publicConfig();
  const described = JSON.stringify({
    checkout: { notice: start.body.checkout.notice, instructions: start.body.checkout.instructions },
    methods: (methods || []).map(({ label, note }) => ({ label, note })),
  });
  assert.ok(!/sandbox|mock|demo/i.test(described), described);

  const completed = await post(`/api/relief/orders/${full.id}/sandbox/pay`, {}, { cookie: donorCookie });
  assert.equal(completed.status, 200);
  assert.equal(completed.body.processed, 'order_paid');
  assert.equal((await repoOrder(order.reference)).status, 'PAID');
});

test('paying with a different method cancels the abandoned attempt', async () => {
  const order = await createDonationOrder(1900);
  const full = await repoOrder(order.reference);
  const first = await post(`/api/relief/orders/${full.id}/payment`, { provider: 'PAYHERE' }, { cookie: donorCookie });
  const second = await post(`/api/relief/orders/${full.id}/payment`, { provider: 'BANK_TRANSFER' }, { cookie: donorCookie });
  assert.equal(second.status, 201);
  assert.notEqual(second.body.payment.id, first.body.payment.id);

  const payments = await repository.listPaymentsByOrder(full.id);
  const byId = Object.fromEntries(payments.map((p) => [p.id, p.status]));
  assert.equal(byId[first.body.payment.id], 'CANCELLED');
  assert.equal(second.body.payment.status, 'AWAITING_CONFIRMATION');
  // Only the method actually chosen may still be completable.
  const attempt = await post(`/api/relief/orders/${full.id}/sandbox/pay`, {}, { cookie: donorCookie });
  assert.equal(attempt.status, 404);
});

async function publicConfig() {
  const res = await fetch(`${baseUrl}/api/relief/config`);
  return res.json();
}

test('audit log records payment confirmations', async () => {
  const { status, body } = await api('/api/relief/staff/audit?action=payment.confirmed_manual', {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(status, 200);
  assert.ok(body.entries.length > 0);
});

/** Full order row (with id) from the repository — public API hides the id. */
async function repoOrder(reference) {
  return repository.getOrderByReference(reference);
}

async function getOrder(reference) {
  return repoOrder(reference);
}

async function loginToken(email, password) {
  const { body } = await post('/api/relief/auth/login', { email, password });
  return body.token;
}
