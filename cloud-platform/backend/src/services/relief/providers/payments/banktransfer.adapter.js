/**
 * Bank transfer adapter — manual confirmation workflow.
 *
 * There is no automated verification API for an ordinary LKR bank transfer,
 * so the payment stays AWAITING_CONFIRMATION until a staff member with the
 * ADMIN role checks the bank statement and confirms it. The donor receives
 * the account details and must quote the order reference as the deposit note.
 */
import crypto from 'node:crypto';
import { env } from '../../../../config/env.js';

export const provider = 'BANK_TRANSFER';

export function isConfigured() {
  // Always available — it is a manual workflow, not an API integration.
  return true;
}

export async function createCheckout({ orderReference, amountLkr }) {
  return {
    provider,
    providerReference: `BANK-${orderReference}`,
    redirectUrl: `${env.donations.publicUrl}/relief/checkout/result?order=${encodeURIComponent(orderReference)}&provider=bank`,
    mode: 'manual',
    notice: 'Transfer the amount to the account below and quote the order reference as the deposit note. '
      + 'Your order is confirmed once our team verifies the transfer (usually within one working day).',
    instructions: {
      bank: 'Bank of Ceylon',
      accountName: 'SmartCamp Relief Fund',
      accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER || 'TO BE CONFIGURED',
      branch: 'Colombo 01',
      reference: orderReference,
      amountLkr: Number(amountLkr),
    },
  };
}

/** No machine-verifiable callback exists; staff confirmation is the source of truth. */
export function verifyWebhook() {
  throw Object.assign(new Error('Bank transfers cannot be verified by webhook — use staff confirmation'), { status: 400 });
}

export function newPayerReference() {
  return `BT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
