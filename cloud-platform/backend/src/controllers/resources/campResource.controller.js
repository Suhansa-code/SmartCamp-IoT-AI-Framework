/**
 * Resources domain controllers — HTTP layer only.
 */
import { getOverview } from '../../services/resources/campData.service.js';

export function getResourceOverview(_req, res) {
  res.json(getOverview());
}