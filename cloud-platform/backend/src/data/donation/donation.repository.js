import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { getPool } from '../../config/database.js';

const memoryDonations = new Map();

export async function listPublicNeeds() {
  if (!env.db.enabled) return [];
  const { rows } = await getPool().query(
    `SELECT id, resource_name, category, unit, available_quantity, minimum_threshold, status
     FROM resources
     ORDER BY CASE status WHEN 'UNAVAILABLE' THEN 0 WHEN 'CRITICAL' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END,
              resource_name
     LIMIT 24`,
  );
  return rows;
}

export async function createDonation(donation) {
  const id = crypto.randomUUID();
  const record = { id, ...donation, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (!env.db.enabled) {
    memoryDonations.set(id, record);
    return record;
  }
  const { rows } = await getPool().query(
    `INSERT INTO donations
      (id, donor_google_id, donor_email, donor_name, donation_type, status, currency, amount_minor,
       resource_name, resource_category, quantity, unit, country, message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [id, donation.donor_google_id, donation.donor_email, donation.donor_name, donation.donation_type,
      donation.status, donation.currency || null, donation.amount_minor || null, donation.resource_name || null,
      donation.resource_category || null, donation.quantity || null, donation.unit || null,
      donation.country || null, donation.message || null],
  );
  return rows[0];
}

export async function attachCheckout(id, checkoutId) {
  if (!env.db.enabled) {
    const current = memoryDonations.get(id);
    if (current) memoryDonations.set(id, { ...current, provider_reference: checkoutId, updated_at: new Date().toISOString() });
    return;
  }
  await getPool().query(
    'UPDATE donations SET provider_reference = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
    [id, checkoutId],
  );
}

export async function markPayment(checkoutId, status, paymentReference) {
  if (!env.db.enabled) {
    for (const [id, current] of memoryDonations) {
      if (current.provider_reference === checkoutId) {
        memoryDonations.set(id, { ...current, status, payment_reference: paymentReference, updated_at: new Date().toISOString() });
        return;
      }
    }
    return;
  }
  await getPool().query(
    `UPDATE donations SET status = $2, payment_reference = $3, updated_at = CURRENT_TIMESTAMP
     WHERE provider_reference = $1`,
    [checkoutId, status, paymentReference || null],
  );
}
