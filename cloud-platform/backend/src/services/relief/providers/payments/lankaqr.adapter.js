/**
 * LankaQR adapter — QR-based payments (standard across Sri Lankan banks).
 *
 * LankaQR is operated per-bank; there is no single public merchant API. In
 * practice merchants either (a) get a QR through their bank's merchant
 * acquiring (e.g. BOC/Commercial Bank merchant portals) and confirm deposits
 * manually, or (b) route LankaQR through a licensed gateway such as PayHere.
 * Until a bank/gateway agreement is in place this adapter issues manual
 * instructions and the payment is verified by authorised staff, exactly like
 * a bank transfer. The payer quotes the LR/UTR reference they receive.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'LANKAQR';

export function isConfigured() {
  return true; // manual confirmation workflow, always available
}

export async function createCheckout({ orderReference, amountLkr }) {
  const lkrRef = `LR-${orderReference}`;
  return {
    provider,
    providerReference: lkrRef,
    redirectUrl: `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=lankaqr`,
    mode: 'manual',
    notice: 'Scan the LankaQR code at checkout with your bank app, pay LKR '
      + `${Number(amountLkr).toLocaleString('en-LK')}, then submit the LR/UTR reference for verification.`,
    instructions: {
      qrPayload: `LKRQR|${process.env.LANKAQR_MERCHANT_ID || 'TO-BE-CONFIGURED'}|${orderReference}|${Number(amountLkr).toFixed(2)}`,
      merchantName: 'SmartCamp Relief Fund',
      reference: lkrRef,
      amountLkr: Number(amountLkr),
      note: 'Payments are verified manually against the bank statement within one working day.',
    },
  };
}

export function verifyWebhook() {
  throw Object.assign(new Error('LankaQR cannot be verified by webhook — use staff confirmation'), { status: 400 });
}

export function newPayerReference() {
  return `LR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
