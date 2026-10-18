/**
 * Payment provider registry — one entry point for the relief payment flow.
 * Each adapter exposes: isConfigured(), createCheckout(), verifyWebhook().
 */
import * as payhere from './payhere.adapter.js';
import * as stripe from './stripe.adapter.js';
import * as bankTransfer from './banktransfer.adapter.js';
import * as lankaQr from './lankaqr.adapter.js';
import * as sandbox from './sandbox.adapter.js';

const ADAPTERS = {
  PAYHERE: payhere,
  STRIPE: stripe,
  BANK_TRANSFER: bankTransfer,
  LANKAQR: lankaQr,
  SANDBOX: sandbox,
};

export function getPaymentAdapter(name) {
  const adapter = ADAPTERS[name];
  if (!adapter) {
    throw Object.assign(new Error(`Unknown payment provider: ${name}`), { status: 400 });
  }
  return adapter;
}

/** Payment methods exposed to the public portal, with honest availability labels. */
export function listPaymentMethods() {
  return [
    {
      key: 'PAYHERE',
      label: 'PayHere',
      enabled: true,
      mode: payhere.isConfigured() ? (payhere.isLive() ? 'live' : 'sandbox') : 'sandbox',
      note: 'Visa, Mastercard, eZ Cash, Genie and bank e-banking.',
    },
    {
      key: 'STRIPE',
      label: 'Credit or debit card',
      enabled: true,
      mode: stripe.isConfigured() ? 'live' : 'sandbox',
      note: 'Visa and Mastercard, processed securely by Stripe.',
    },
    {
      key: 'BANK_TRANSFER',
      label: 'Bank transfer',
      enabled: true,
      mode: 'manual',
      note: 'Verified manually by our team within one working day.',
    },
    {
      key: 'LANKAQR',
      label: 'LankaQR',
      enabled: true,
      mode: 'manual',
      note: 'Scan and pay with any LankaQR-enabled bank app, then submit the reference.',
    },
  ];
}
