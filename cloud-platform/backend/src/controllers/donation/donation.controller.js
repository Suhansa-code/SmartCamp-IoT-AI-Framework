import { env } from '../../config/env.js';
import * as repository from '../../data/donation/donation.repository.js';
import { createSession, readSession, verifyGoogleCredential } from '../../services/donation/auth.service.js';
import { createCheckout, verifyStripeWebhook } from '../../services/donation/payment.service.js';

const FALLBACK_NEEDS = [
  { id: 'water', resource_name: 'Drinking water', category: 'water', unit: 'L', available_quantity: 420, minimum_threshold: 1200, status: 'CRITICAL' },
  { id: 'rice', resource_name: 'Rice', category: 'food', unit: 'kg', available_quantity: 680, minimum_threshold: 1000, status: 'LOW' },
  { id: 'hygiene', resource_name: 'Hygiene kits', category: 'hygiene', unit: 'kits', available_quantity: 90, minimum_threshold: 300, status: 'CRITICAL' },
  { id: 'blankets', resource_name: 'Blankets', category: 'shelter', unit: 'items', available_quantity: 540, minimum_threshold: 400, status: 'AVAILABLE' },
];
const CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'LKR']);
const CATEGORIES = new Set(['water', 'food', 'medical', 'hygiene', 'shelter', 'other']);

export function getConfig(_req, res) {
  res.json({
    googleClientId: env.donations.googleClientId || null,
    paymentsEnabled: Boolean(env.donations.stripeSecretKey),
    currencies: [...CURRENCIES],
  });
}

export async function getNeeds(_req, res, next) {
  try {
    const rows = await repository.listPublicNeeds();
    res.json({ resources: rows.length ? rows : FALLBACK_NEEDS, live: rows.length > 0 });
  } catch (error) {
    next(error);
  }
}

export async function googleSignIn(req, res, next) {
  try {
    const user = await verifyGoogleCredential(req.body?.credential);
    const session = createSession(user);
    res.cookie('smartcamp_donor', session, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export function getCurrentDonor(req, res) {
  res.json({ user: readSession(req) });
}

export function signOut(_req, res) {
  res.clearCookie('smartcamp_donor', { httpOnly: true, sameSite: 'lax', path: '/' });
  res.status(204).end();
}

export async function createInKindDonation(req, res, next) {
  try {
    const resourceName = String(req.body?.resource_name || '').trim().slice(0, 120);
    const category = String(req.body?.category || '').toLowerCase();
    const unit = String(req.body?.unit || '').trim().slice(0, 30);
    const quantity = Number(req.body?.quantity);
    const country = String(req.body?.country || '').trim().slice(0, 80);
    const message = String(req.body?.message || '').trim().slice(0, 500);
    if (!resourceName || !CATEGORIES.has(category) || !unit || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || !country) {
      return res.status(400).json({ error: 'Provide a valid resource, quantity, unit, category, and country' });
    }
    const donation = await repository.createDonation({
      donor_google_id: req.donor?.id || 'guest-demo', donor_email: req.donor?.email || 'guest@smartcamp.lk', donor_name: req.donor?.name || 'Guest donor',
      donation_type: 'IN_KIND', status: 'PLEDGED', resource_name: resourceName,
      resource_category: category, quantity, unit, country, message,
    });
    res.status(201).json({ donation, message: 'Your offer is recorded. Our team will contact you to arrange delivery.' });
  } catch (error) {
    next(error);
  }
}

export async function startCheckout(req, res, next) {
  try {
    const amount = Number(req.body?.amount);
    const currency = String(req.body?.currency || '').toUpperCase();
    const message = String(req.body?.message || '').trim().slice(0, 200);
    if (!Number.isFinite(amount) || amount < 1 || amount > 1000000 || !CURRENCIES.has(currency)) {
      return res.status(400).json({ error: 'Provide a supported currency and an amount between 1 and 1,000,000' });
    }
    const amountMinor = Math.round(amount * 100);
    const donation = await repository.createDonation({
      donor_google_id: req.donor.id, donor_email: req.donor.email, donor_name: req.donor.name,
      donation_type: 'MONEY', status: 'PENDING_PAYMENT', currency, amount_minor: amountMinor, message,
    });
    const checkout = await createCheckout({ donationId: donation.id, amountMinor, currency, donorEmail: req.donor.email, message });
    await repository.attachCheckout(donation.id, checkout.id);
    res.status(201).json({ checkoutUrl: checkout.url });
  } catch (error) {
    next(error);
  }
}

export async function stripeWebhook(req, res, next) {
  try {
    const event = verifyStripeWebhook(req.body, req.headers['stripe-signature']);
    if (event.type === 'checkout.session.completed') {
      await repository.markPayment(event.data.object.id, 'PAID', event.data.object.payment_intent);
    } else if (event.type === 'checkout.session.expired') {
      await repository.markPayment(event.data.object.id, 'EXPIRED', null);
    }
    res.json({ received: true });
  } catch (error) {
    next(error);
  }
}
