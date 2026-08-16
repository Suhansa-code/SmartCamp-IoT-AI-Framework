import crypto from 'crypto';

export function genPassword() {
  return crypto.randomBytes(16).toString('hex');
}

export function genId(prefix) {
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${Date.now()}_${rand}`;
}
