/**
 * stationMeta.js — Single source of truth for gauging-station metadata.
 *
 * Used by:
 *   - campsAggregation.service.js (alert thresholds, coordinates, distances)
 *   - camps.data.js (camp detail seed data)
 *
 * Each entry contains:
 *   alertL   – water level that triggers an alert (m)
 *   minorL   – minor flood level (m)
 *   majorL   – major flood level (m)
 *   gauLat   – gauge latitude
 *   gauLng   – gauge longitude
 *   stDist   – distance from camp to station (m)
 *   upDist   – upstream distance (m)
 *   river    – river name
 *   waterPath – water path / downstream water body
 *   type     – disaster type (FLOOD, CYCLONE, LANDSLIDE, STORM, DROUGHT)
 *   capacity – camp capacity (persons)
 */

export const STATION_META = {
  Baddegama:        { alertL: 4.5, minorL: 5.5, majorL: 7.0, gauLat: 6.06,   gauLng: 80.19,  stDist: 8420,  upDist: 640,  river: 'Gin Ganga',       waterPath: 'Gin Ganga',       type: 'FLOOD',     capacity: 4000 },
  Chenkalady:       { alertL: 3.0, minorL: 4.0, majorL: 5.5, gauLat: 7.75,   gauLng: 81.70,  stDist: 14200, upDist: 820,  river: 'Verugal Aru',      waterPath: 'Batticaloa Lag.', type: 'CYCLONE',   capacity: 2500 },
  Weraganthota:     { alertL: 5.0, minorL: 6.0, majorL: 8.0, gauLat: 7.3175, gauLng: 80.988, stDist: 20136, upDist: 1524, river: 'Mahaweli Ganga',   waterPath: 'Heen Ganga',      type: 'LANDSLIDE', capacity: 2000 },
  Ratnapura:        { alertL: 5.5, minorL: 6.5, majorL: 8.5, gauLat: 6.70,   gauLng: 80.40,  stDist: 3200,  upDist: 280,  river: 'Kalu Ganga',       waterPath: 'Kalu Ganga',      type: 'FLOOD',     capacity: 1000 },
  Ampara:           { alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 7.32,   gauLng: 81.68,  stDist: 6800,  upDist: 950,  river: 'Amparai Aru',      waterPath: 'Amparai Tank',    type: 'FLOOD',     capacity: 700 },
  'Nagalagam St.':  { alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 6.94,   gauLng: 79.88,  stDist: 5500,  upDist: 420,  river: 'Kelani River',     waterPath: 'Kelani Ganga',    type: 'FLOOD',     capacity: 800 },
  Pitabeddara:      { alertL: 4.0, minorL: 5.0, majorL: 6.5, gauLat: 5.99,   gauLng: 80.55,  stDist: 9100,  upDist: 760,  river: 'Nilwala Ganga',    waterPath: 'Nilwala Ganga',   type: 'STORM',     capacity: 900 },
  Embilipitiya:     { alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.15,   gauLng: 81.10,  stDist: 18000, upDist: 2100, river: 'Walawe River',     waterPath: 'Walawe Ganga',    type: 'STORM',     capacity: 600 },
  Chavakachcheri:   { alertL: 2.0, minorL: 3.0, majorL: 4.0, gauLat: 9.65,   gauLng: 80.03,  stDist: 11200, upDist: 1800, river: 'Parangi Aru',      waterPath: 'Jaffna Lagoon',   type: 'DROUGHT',   capacity: 1200 },
  'Nuwara Eliya':   { alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.97,   gauLng: 80.77,  stDist: 4300,  upDist: 380,  river: 'Mahaweli Ganga',   waterPath: 'Kotmale Oya',     type: 'LANDSLIDE', capacity: 500 },
  Manampitiya:      { alertL: 5.0, minorL: 6.5, majorL: 9.0, gauLat: 8.56,   gauLng: 81.22,  stDist: 22400, upDist: 3200, river: 'Mahaweli Ganga',   waterPath: 'Mahaweli Delta',  type: 'FLOOD',     capacity: 900 },
  Maradankadawala:  { alertL: 4.5, minorL: 5.5, majorL: 7.5, gauLat: 8.36,   gauLng: 80.38,  stDist: 16500, upDist: 2400, river: 'Malwathu Oya',     waterPath: 'Malwathu Oya',    type: 'DROUGHT',   capacity: 600 },
  Vavuniya:         { alertL: 3.0, minorL: 4.0, majorL: 5.5, gauLat: 8.74,   gauLng: 80.51,  stDist: 7800,  upDist: 1100, river: 'Parangi Aru',      waterPath: 'Iranamadu Tank',  type: 'DROUGHT',   capacity: 400 },
  Kurunegala:       { alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 7.49,   gauLng: 80.35,  stDist: 5600,  upDist: 620,  river: 'Deduru Oya',       waterPath: 'Deduru Oya',      type: 'FLOOD',     capacity: 500 },
};

/**
 * Get station metadata by station name.
 * Returns null if the station is not found.
 */
export function getStationMeta(stationName) {
  return STATION_META[stationName] || null;
}

/**
 * Get all station names.
 */
export function getStationNames() {
  return Object.keys(STATION_META);
}
