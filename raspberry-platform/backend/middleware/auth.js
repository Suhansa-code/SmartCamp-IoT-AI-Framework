import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_THIS_SECRET';

export function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    logger.warn(`[AUTH] Missing token: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const reason = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    logger.warn(`[AUTH] ${reason}: ${req.method} ${req.originalUrl}`);
    return res.status(401).json({ success: false, message: reason });
  }
}
