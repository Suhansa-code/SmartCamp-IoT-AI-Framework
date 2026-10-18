import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
let jwksCache = { expiresAt: 0, keys: [] };

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url');
}

function parseJsonPart(value) {
  return JSON.parse(fromBase64Url(value).toString('utf8'));
}

async function getGoogleKey(kid) {
  if (Date.now() >= jwksCache.expiresAt) {
    const response = await fetch(GOOGLE_JWKS_URL);
    if (!response.ok) throw Object.assign(new Error('Google authentication is unavailable'), { status: 503 });
    const cacheControl = response.headers.get('cache-control') || '';
    const maxAge = Number(cacheControl.match(/max-age=(\d+)/)?.[1] || 3600);
    const payload = await response.json();
    jwksCache = { expiresAt: Date.now() + maxAge * 1000, keys: payload.keys || [] };
  }
  return jwksCache.keys.find((key) => key.kid === kid);
}

export async function verifyGoogleCredential(credential) {
  if (!env.donations.googleClientId) {
    throw Object.assign(new Error('Google sign-in has not been configured'), { status: 503 });
  }

  const parts = String(credential || '').split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Invalid Google credential'), { status: 401 });

  let header;
  let payload;
  try {
    header = parseJsonPart(parts[0]);
    payload = parseJsonPart(parts[1]);
  } catch {
    throw Object.assign(new Error('Invalid Google credential'), { status: 401 });
  }

  if (header.alg !== 'RS256') throw Object.assign(new Error('Unsupported Google credential'), { status: 401 });
  const jwk = await getGoogleKey(header.kid);
  if (!jwk) throw Object.assign(new Error('Google signing key was not found'), { status: 401 });

  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    fromBase64Url(parts[2]),
  );
  const now = Math.floor(Date.now() / 1000);
  const issuerValid = ['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss);
  if (!valid || !issuerValid || payload.aud !== env.donations.googleClientId || payload.exp <= now || !payload.email_verified) {
    throw Object.assign(new Error('Google credential could not be verified'), { status: 401 });
  }

  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name || payload.email,
    picture: payload.picture || null,
  };
}

function sign(value) {
  return crypto.createHmac('sha256', env.donations.sessionSecret).update(value).digest('base64url');
}

export function createSession(user) {
  const encoded = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function readSession(req) {
  const cookies = {};
  for (const entry of String(req.headers.cookie || '').split(';')) {
    const separator = entry.indexOf('=');
    if (separator < 0) continue;
    try {
      const key = decodeURIComponent(entry.slice(0, separator).trim());
      cookies[key] = decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      // Ignore malformed unrelated cookies rather than failing authentication.
    }
  }
  const [encoded, signature] = String(cookies.smartcamp_donor || '').split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(fromBase64Url(encoded).toString('utf8'));
    return user.exp > Date.now() ? user : null;
  } catch {
    return null;
  }
}

export function requireDonor(req, res, next) {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: 'Sign in with Google to continue' });
  req.donor = user;
  next();
}
