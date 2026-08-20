/**
 * Education domain repository — facade.
 *
 * Selects the active persistence backend:
 *   - PostgreSQL when env.db.enabled is true (AWS VM / production)
 *   - in-memory seeded repository otherwise (local dev / tests)
 *
 * Both implementations expose the exact same function contract, so nothing
 * above this layer needs to know which backend is active.
 */
import { env } from '../../config/env.js';
import * as memoryRepository from './alert.memory.repository.js';
import * as postgresRepository from './alert.postgres.repository.js';

const active = env.db.enabled ? postgresRepository : memoryRepository;

export const getAlerts = active.getAlerts;
export const getAlert = active.getAlert;
export const upsertAlert = active.upsertAlert;
export const resolveAlert = active.resolveAlert;
export const syncChildren = active.syncChildren;
export const syncSessions = active.syncSessions;
export const getCampSummaries = active.getCampSummaries;
export const getCampEducation = active.getCampEducation;
