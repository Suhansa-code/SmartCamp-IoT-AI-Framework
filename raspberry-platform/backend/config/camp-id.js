/**
 * camp-id.js — CAMP_ID is always equal to DEVICE_ID.
 *
 * Previously, CAMP_ID was derived from GPS location names (e.g., "Homagama" → "CAMP-H").
 * That flow has been removed. CAMP_ID now exactly equals DEVICE_ID from .env.
 */
import C from './constants.js';

/**
 * Get the camp ID (always equals DEVICE_ID).
 */
export function getCampId() {
  return C.DEVICE_ID;
}
