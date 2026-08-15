import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_PATH = path.join(__dirname, '..', '..', 'data', 'resource', 'distribution.json');

const ITEMS = [
  { key: 'breakfast', label: 'Breakfast', unit: 'kg' },
  { key: 'lunch', label: 'Lunch', unit: 'kg' },
  { key: 'dinner', label: 'Dinner', unit: 'kg' },
  { key: 'water', label: 'Water', unit: 'L' },
];

let _quantities = null;
function getQuantities() {
  if (!_quantities) {
    _quantities = JSON.parse(fs.readFileSync(DIST_PATH, 'utf-8'));
  }
  return _quantities;
}

/**
 * Per-person daily entitlement for each ration item, read from the same
 * distribution.json that drives `/api/distribute`. Pregnant residents get
 * the `pregnant_extra` top-up on top of the standard portion.
 */
export function getDailyEntitlement(person = {}) {
  const { standard = {}, pregnant_extra = {} } = getQuantities();
  const extra = person.is_pregnant === 1 ? pregnant_extra : {};
  return ITEMS.map((item) => ({
    ...item,
    quantity: (standard[item.key] || 0) + (extra[item.key] || 0),
  }));
}

/**
 * Daily availability left for a person, given today's flags (which meals /
 * water have already been handed out). A given item has nothing left; an
 * ungiven item still has its full entitlement available.
 */
export function getDailyLeft(person, givenFlags = {}) {
  return getDailyEntitlement(person).map((item) => {
    const given = Boolean(givenFlags[item.key]);
    return { ...item, given, left: given ? 0 : item.quantity };
  });
}
