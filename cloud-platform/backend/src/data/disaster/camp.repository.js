/**
 * Disaster camp repository — re-exports the in-memory camp data functions
 * from the data layer. The functions are already defined in camps.data.js.
 */
export {
  getDisasterCampById,
  getDisasterCampSummaries,
  getDisasterDashboardSummary,
  getDisasterMapNodes,
} from './camps.data.js';
