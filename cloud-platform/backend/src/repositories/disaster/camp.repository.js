/**
 * Disaster domain repository — facade.
 *
 * Selects the active persistence backend:
 *   - PostgreSQL when env.db.enabled is true (AWS VM / Neon / production)
 *   - in-memory seeded repository otherwise (local dev / tests)
 *
 * Both implementations expose the exact same function contract, so nothing
 * above this layer needs to know which backend is active.
 */
import { env } from '../../config/env.js';
import * as memoryRepository from './camp.memory.repository.js';
import * as postgresRepository from './camp.postgres.repository.js';

const active = env.db.enabled ? postgresRepository : memoryRepository;

export const getDisasterCampById = active.getDisasterCampById;
export const getDisasterCampSummaries = active.getDisasterCampSummaries;
export const getDisasterDashboardSummary = active.getDisasterDashboardSummary;
export const getDisasterMapNodes = active.getDisasterMapNodes;