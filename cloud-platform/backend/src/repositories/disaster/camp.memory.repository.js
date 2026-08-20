/**
 * Disaster domain repository — in-memory implementation.
 *
 * Backed by the static seed in src/data/disaster/camps.data.js. Exposes the
 * same promise-based interface as the PostgreSQL repository, so controllers
 * never change when a real database is swapped in.
 */
import * as data from '../../data/disaster/camps.data.js';

export async function getDisasterCampById(campId) {
  return data.getDisasterCampById(campId);
}

export async function getDisasterCampSummaries() {
  return data.getDisasterCampSummaries();
}

export async function getDisasterDashboardSummary() {
  return data.getDisasterDashboardSummary();
}

export async function getDisasterMapNodes() {
  return data.getDisasterMapNodes();
}