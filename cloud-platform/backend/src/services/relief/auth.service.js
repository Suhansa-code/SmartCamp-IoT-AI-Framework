/**
 * Relief staff authentication — scrypt password hashing + HMAC-signed bearer
 * tokens (same construction as the donor session, different secret/cookie so
 * donor and staff credentials can never be confused).
 *
 * Roles: ADMIN | PARTNER | COLLECTION_CENTRE | CAMP_MANAGER.
 * Donors keep using the existing Google session from donation/auth.service.js.
 */
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { readSession as readDonorSession } from '../donation/auth.service.js';
import * as repository from '../../data/relief/relief.repository.js';

const COOKIE = 'smartcamp_relief';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function sessionSecret() {
  // Falls back to the donation secret when not explicitly set (dev only).
  return process.env.RELIEF_SESSION_SECRET || env.donations.sessionSecret;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

export function createStaffSession(user) {
  const payload = {
    id: user.id, email: user.email, name: user.display_name,
    role: user.role, org_code: user.org_code || null,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${encoded}.${sign(encoded)}`, user: payload };
}

function readToken(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (signature.length !== expected.length
      || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

function readCookie(req, name) {
  for (const entry of String(req.headers.cookie || '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    try {
      const key = decodeURIComponent(entry.slice(0, separator).trim());
      if (key === name) return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      // ignore malformed unrelated cookies
    }
  }
  return null;
}

export function readStaffSession(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return readToken(bearer) || readToken(readCookie(req, COOKIE));
}

export function setStaffSessionCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearStaffSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export async function login(email, password) {
  const user = await repository.getStaffUserByEmail(String(email || '').trim().toLowerCase());
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }
  return createStaffSession(user);
}

/** Requires any signed-in staff session. */
export function requireStaff(req, res, next) {
  const user = readStaffSession(req);
  if (!user) return res.status(401).json({ error: 'Staff sign-in required' });
  req.staff = user;
  next();
}

/** Requires one of the listed roles. */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.staff) return res.status(401).json({ error: 'Staff sign-in required' });
    if (!roles.includes(req.staff.role)) {
      return res.status(403).json({ error: `Requires role: ${roles.join(' or ')}` });
    }
    next();
  };
}

/** Creates the initial admin from env on first boot (used by the seed script). */
export function bootstrapPassword() {
  return process.env.RELIEF_ADMIN_PASSWORD || 'ChangeMe123!';
}

/**
 * Allows either a signed-in donor (Google session) or, when guest checkout is
 * enabled (sandbox mode), an anonymous guest. Guests receive a per-request
 * synthetic donor identity and track their order by its public reference.
 * This deliberately does NOT weaken payment verification — staff still verify
 * every manual payment and webhooks are still signature-checked.
 */
export async function requireDonorOrGuest(req, res, next) {
  const donor = readDonorSession(req);
  if (donor) {
    req.donor = donor;
    req.isGuest = false;
    return next();
  }
  if (!env.relief.guestCheckout) {
    return res.status(401).json({ error: 'Sign in with Google to continue' });
  }
  const guestId = req.get('X-Relief-Guest') || `guest-${crypto.randomBytes(8).toString('hex')}`;
  req.donor = { id: guestId, email: 'guest@relief.smartcamp.lk', name: 'Guest donor', picture: null };
  req.isGuest = true;
  next();
}
