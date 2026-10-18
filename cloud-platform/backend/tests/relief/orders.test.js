import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.DB_ENABLED = 'false';

const { createApp } = await import('../../src/app.js');
const auth = await import('../../src/services/donation/auth.service.js');

let baseUrl;
let server;
let donorCookie;

before(async () => {
  const app = createApp();
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Craft a donor session cookie with the same in-process secret.
  const session = auth.createSession({ id: 'donor-1', email: 'donor@example.lk', name: 'Donor One', picture: null });
  donorCookie = `smartcamp_donor=${encodeURIComponent(session)}`;
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

test('relief config exposes payment methods and labelled destinations', async () => {
  const { status, body } = await api('/api/relief/config');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.payment_methods));
  assert.ok(body.payment_methods.some((m) => m.key === 'PAYHERE'));
  assert.ok(body.payment_methods.some((m) => m.key === 'BANK_TRANSFER'));
  assert.ok(body.destinations.COLLECTION_CENTRE.length > 0);
  assert.ok(body.transparency);
});

test('catalogue is labelled — sandbox, never fabricated as live', async () => {
  const { status, body } = await api('/api/relief/catalogue');
  assert.equal(status, 200);
  assert.equal(body.catalogues.length, 4);
  for (const catalogue of body.catalogues) {
    assert.equal(catalogue.is_live, false);
    assert.equal(catalogue.availability_source, 'SANDBOX');
    assert.ok(catalogue.notice.includes('sample catalogue'));
    for (const product of catalogue.products) {
      assert.equal(product.availability_source, 'SANDBOX');
      assert.ok(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN'].includes(product.stock_status));
    }
  }
});

test('catalogue filters by partner', async () => {
  const { status, body } = await api('/api/relief/catalogue?partner=keells');
  assert.equal(status, 200);
  assert.equal(body.catalogues.length, 1);
  assert.equal(body.catalogues[0].partner_code, 'KEELLS');
});

test('guest checkout is allowed in sandbox mode but order history requires sign-in', async () => {
  const created = await post('/api/relief/orders', { kind: 'MONEY_DONATION', amount_lkr: 1000 });
  assert.equal(created.status, 201);
  assert.equal(created.body.order.status, 'CREATED');
  // A guest cannot list order history — that path still requires a donor session.
  const history = await api('/api/relief/orders');
  assert.equal(history.status, 401);
});

test('purchase order prices come from the server catalogue, not the client', async () => {
  const res = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [
      // Client lies about the price; server must ignore it.
      { partner_code: 'KEELLS', sku: 'SBX-K-001', quantity: 2, unit_price_lkr: 1 },
    ],
    destination_type: 'COLLECTION_CENTRE',
    destination_code: 'CC-KLN',
  }, { cookie: donorCookie });
  assert.equal(res.status, 201);
  assert.equal(res.body.order.partner_code, 'KEELLS');
  // Sandbox price for SBX-K-001 is 890 → 2 units = 1780.
  assert.equal(res.body.order.subtotal_lkr, 1780);
  assert.equal(res.body.order.total_lkr, 1780);
  assert.equal(res.body.order.items[0].unit_price_lkr, 890);
  assert.equal(res.body.order.status, 'CREATED');
  assert.ok(res.body.order.reference.startsWith('SRO-'));
});

test('Idempotency-Key prevents duplicate orders', async () => {
  const payload = {
    kind: 'RESOURCE_PURCHASE',
    items: [{ partner_code: 'KEELLS', sku: 'SBX-K-002', quantity: 1 }],
    destination_type: 'CAMP',
    destination_code: 'SCB-UNIT-01',
  };
  const headers = { cookie: donorCookie, 'idempotency-key': 'test-key-123' };
  const first = await post('/api/relief/orders', payload, headers);
  assert.equal(first.status, 201);
  const second = await post('/api/relief/orders', payload, headers);
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent_replay, true);
  assert.equal(second.body.order.reference, first.body.order.reference);
});

test('out-of-stock products cannot be ordered', async () => {
  const { status, body } = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [{ partner_code: 'KEELLS', sku: 'SBX-K-005', quantity: 1 }],
    destination_type: 'COLLECTION_CENTRE',
    destination_code: 'CC-KLN',
  }, { cookie: donorCookie });
  assert.equal(status, 409);
  assert.match(body.error, /out of stock/i);
});

test('money donation order validates amount bounds', async () => {
  const tooSmall = await post('/api/relief/orders', { kind: 'MONEY_DONATION', amount_lkr: 5 }, { cookie: donorCookie });
  assert.equal(tooSmall.status, 400);
  const ok = await post('/api/relief/orders', { kind: 'MONEY_DONATION', amount_lkr: 2500, message: 'stay safe' }, { cookie: donorCookie });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.order.total_lkr, 2500);
  assert.equal(ok.body.order.kind, 'MONEY_DONATION');
});

test('unknown destinations are rejected', async () => {
  const { status } = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [{ partner_code: 'KEELLS', sku: 'SBX-K-001', quantity: 1 }],
    destination_type: 'CAMP',
    destination_code: 'NO-SUCH-CAMP',
  }, { cookie: donorCookie });
  assert.equal(status, 400);
});

test('mixed-partner carts are rejected', async () => {
  const { status } = await post('/api/relief/orders', {
    kind: 'RESOURCE_PURCHASE',
    items: [
      { partner_code: 'KEELLS', sku: 'SBX-K-001', quantity: 1 },
      { partner_code: 'SPAR', sku: 'SBX-S-001', quantity: 1 },
    ],
    destination_type: 'COLLECTION_CENTRE',
    destination_code: 'CC-KLN',
  }, { cookie: donorCookie });
  assert.equal(status, 400);
});

test('public order tracking does not leak donor identity', async () => {
  const created = await post('/api/relief/orders', { kind: 'MONEY_DONATION', amount_lkr: 500 }, { cookie: donorCookie });
  const { status, body } = await api(`/api/relief/orders/${created.body.order.reference}`);
  assert.equal(status, 200);
  assert.equal(body.order.reference, created.body.order.reference);
  assert.equal(body.order.donor_email, undefined);
  assert.equal(body.order.donor_google_id, undefined);
  assert.equal(body.order.idempotency_key, undefined);
});
