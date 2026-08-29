/**
 * Static seed data for the Disaster domain.
 * Source of truth for the disaster-management dashboard (camps + gauging details).
 *
 * Station metadata (alertL, minorL, majorL, gauLat, gauLng, stDist, upDist,
 * river, waterPath, type, capacity) is imported from stationMeta.js to avoid
 * duplication.  CAMP_DETAIL adds only camp-specific fields (wl, rain, elev,
 * weather, soil, etc.).
 */
import { STATION_META } from './stationMeta.js';

export const CAMPS = [
  { id: 'galle', code: 'GAL', name: 'Galle Flood Emergency', lat: 6.03, lng: 80.22, status: 'critical', displaced: 3840, capacity: 4000, aid: 41, type: 'FLOOD', workers: 124 },
  { id: 'batticaloa', code: 'BTC', name: 'Batticaloa Cyclone Camp', lat: 7.72, lng: 81.68, status: 'high', displaced: 2215, capacity: 2500, aid: 55, type: 'CYCLONE', workers: 88 },
  { id: 'kandy', code: 'KDY', name: 'Kandy Landslide Relief', lat: 7.29, lng: 80.64, status: 'high', displaced: 1620, capacity: 2000, aid: 63, type: 'LANDSLIDE', workers: 76 },
  { id: 'ratnapura', code: 'RAT', name: 'Ratnapura Flood Camp', lat: 6.68, lng: 80.40, status: 'high', displaced: 890, capacity: 1000, aid: 47, type: 'FLOOD', workers: 42 },
  { id: 'ampara', code: 'AMP', name: 'Ampara East Relief', lat: 7.30, lng: 81.50, status: 'high', displaced: 510, capacity: 700, aid: 52, type: 'FLOOD', workers: 31 },
  { id: 'colombo', code: 'CMB', name: 'Colombo Urban Relief', lat: 6.92, lng: 79.86, status: 'medium', displaced: 540, capacity: 800, aid: 72, type: 'FLOOD', workers: 38 },
  { id: 'matara', code: 'MAT', name: 'Matara Coastal Storm', lat: 5.97, lng: 80.54, status: 'medium', displaced: 760, capacity: 900, aid: 58, type: 'STORM', workers: 35 },
  { id: 'hambantota', code: 'HMB', name: 'Hambantota Storm Camp', lat: 6.12, lng: 81.12, status: 'medium', displaced: 440, capacity: 600, aid: 69, type: 'STORM', workers: 28 },
  { id: 'jaffna', code: 'JFN', name: 'Jaffna Drought Relief', lat: 9.67, lng: 80.01, status: 'medium', displaced: 980, capacity: 1200, aid: 82, type: 'DROUGHT', workers: 54 },
  { id: 'nuwara', code: 'NWE', name: 'Nuwara Eliya Landslide', lat: 6.97, lng: 80.77, status: 'medium', displaced: 360, capacity: 500, aid: 76, type: 'LANDSLIDE', workers: 22 },
  { id: 'trinco', code: 'TRC', name: 'Trincomalee Flood Camp', lat: 8.58, lng: 81.22, status: 'stable', displaced: 620, capacity: 900, aid: 91, type: 'FLOOD', workers: 47 },
  { id: 'anuradhapura', code: 'ANU', name: 'Anuradhapura Relief', lat: 8.34, lng: 80.41, status: 'stable', displaced: 310, capacity: 600, aid: 88, type: 'DROUGHT', workers: 29 },
  { id: 'vavuniya', code: 'VAV', name: 'Vavuniya North Camp', lat: 8.76, lng: 80.50, status: 'stable', displaced: 180, capacity: 400, aid: 95, type: 'DROUGHT', workers: 18 },
  { id: 'kurunegala', code: 'KUR', name: 'Kurunegala Relief', lat: 7.48, lng: 80.37, status: 'recovery', displaced: 275, capacity: 500, aid: 94, type: 'FLOOD', workers: 21 },
]

// Camp-specific data (weather, water level, soil, etc.) keyed by camp ID.
// Station metadata (alertL, minorL, majorL, gauLat, gauLng, stDist, upDist,
// river, waterPath, type, capacity) is derived from STATION_META at export time.
const _CAMP_RAW = {
  galle:         { station: 'Baddegama',        wl: -0.42, rain: 18, fcLat: 6.04,  fcLng: 80.22,  elev: 4,    minT: 25.1, maxT: 31.2, hum: 89, precip: 18.2, maxHrPrec: 4.1, maxWind: 22, avgWind: 9,  soil: 0.38, pres: 1008, cloud: 90 },
  batticaloa:    { station: 'Chenkalady',       wl: 1.12,  rain: 6,  fcLat: 7.72,  fcLng: 81.68,  elev: 2,    minT: 26.0, maxT: 32.8, hum: 84, precip: 6.0,  maxHrPrec: 1.2, maxWind: 18, avgWind: 7,  soil: 0.28, pres: 1010, cloud: 75 },
  kandy:         { station: 'Weraganthota',     wl: -2.76, rain: 0,  fcLat: 7.487, fcLng: 80.985, elev: 79,   minT: 24.5, maxT: 30.3, hum: 91, precip: 6.5,  maxHrPrec: 1.7, maxWind: 8,  avgWind: 2,  soil: 0.301, pres: 997, cloud: 100 },
  ratnapura:     { station: 'Ratnapura',        wl: 2.14,  rain: 42, fcLat: 6.68,  fcLng: 80.40,  elev: 18,   minT: 23.8, maxT: 29.4, hum: 94, precip: 42.0, maxHrPrec: 9.8, maxWind: 12, avgWind: 4,  soil: 0.42, pres: 993, cloud: 100 },
  ampara:        { station: 'Ampara',           wl: 0.88,  rain: 4,  fcLat: 7.30,  fcLng: 81.50,  elev: 35,   minT: 27.2, maxT: 33.5, hum: 80, precip: 4.2,  maxHrPrec: 0.8, maxWind: 14, avgWind: 5,  soil: 0.24, pres: 1012, cloud: 60 },
  colombo:       { station: 'Nagalagam St.',    wl: 0.66,  rain: 12, fcLat: 6.92,  fcLng: 79.86,  elev: 8,    minT: 26.5, maxT: 32.0, hum: 87, precip: 12.4, maxHrPrec: 3.2, maxWind: 20, avgWind: 8,  soil: 0.33, pres: 1006, cloud: 85 },
  matara:        { station: 'Pitabeddara',      wl: -1.10, rain: 22, fcLat: 5.97,  fcLng: 80.54,  elev: 6,    minT: 25.8, maxT: 31.0, hum: 90, precip: 22.0, maxHrPrec: 5.5, maxWind: 25, avgWind: 11, soil: 0.36, pres: 1005, cloud: 95 },
  hambantota:    { station: 'Embilipitiya',     wl: -0.30, rain: 8,  fcLat: 6.12,  fcLng: 81.12,  elev: 12,   minT: 28.0, maxT: 34.5, hum: 78, precip: 8.0,  maxHrPrec: 2.0, maxWind: 16, avgWind: 6,  soil: 0.22, pres: 1010, cloud: 55 },
  jaffna:        { station: 'Chavakachcheri',   wl: -3.50, rain: 0,  fcLat: 9.67,  fcLng: 80.01,  elev: 5,    minT: 29.0, maxT: 36.0, hum: 72, precip: 0.2,  maxHrPrec: 0.1, maxWind: 28, avgWind: 12, soil: 0.14, pres: 1014, cloud: 20 },
  nuwara:        { station: 'Nuwara Eliya',     wl: 0.22,  rain: 14, fcLat: 6.97,  fcLng: 80.77,  elev: 1868, minT: 14.0, maxT: 20.5, hum: 95, precip: 14.0, maxHrPrec: 3.8, maxWind: 10, avgWind: 3,  soil: 0.44, pres: 830, cloud: 100 },
  trinco:        { station: 'Manampitiya',      wl: -1.80, rain: 2,  fcLat: 8.58,  fcLng: 81.22,  elev: 3,    minT: 27.5, maxT: 34.0, hum: 80, precip: 2.4,  maxHrPrec: 0.6, maxWind: 15, avgWind: 6,  soil: 0.25, pres: 1011, cloud: 40 },
  anuradhapura:  { station: 'Maradankadawala',  wl: -2.10, rain: 0,  fcLat: 8.34,  fcLng: 80.41,  elev: 81,   minT: 27.0, maxT: 35.5, hum: 70, precip: 1.0,  maxHrPrec: 0.3, maxWind: 18, avgWind: 7,  soil: 0.18, pres: 1011, cloud: 25 },
  vavuniya:      { station: 'Vavuniya',         wl: -1.40, rain: 1,  fcLat: 8.76,  fcLng: 80.50,  elev: 98,   minT: 28.5, maxT: 36.0, hum: 68, precip: 1.2,  maxHrPrec: 0.4, maxWind: 20, avgWind: 8,  soil: 0.16, pres: 1012, cloud: 18 },
  kurunegala:    { station: 'Kurunegala',       wl: 0.14,  rain: 6,  fcLat: 7.48,  fcLng: 80.37,  elev: 116,  minT: 26.0, maxT: 32.5, hum: 82, precip: 6.2,  maxHrPrec: 1.4, maxWind: 11, avgWind: 4,  soil: 0.27, pres: 1005, cloud: 70 },
};

// Merge station metadata into camp-specific data to produce CAMP_DETAIL.
export const CAMP_DETAIL = Object.fromEntries(
  Object.entries(_CAMP_RAW).map(([campId, raw]) => {
    const meta = STATION_META[raw.station] || {};
    return [campId, {
      waterPath: meta.waterPath,
      river:     meta.river,
      station:   raw.station,
      stDist:    meta.stDist,
      upDist:    meta.upDist,
      wl:        raw.wl,
      rain:      raw.rain,
      alertL:    meta.alertL,
      minorL:    meta.minorL,
      majorL:    meta.majorL,
      gauLat:    meta.gauLat,
      gauLng:    meta.gauLng,
      fcLat:     raw.fcLat,
      fcLng:     raw.fcLng,
      elev:      raw.elev,
      minT:      raw.minT,
      maxT:      raw.maxT,
      hum:       raw.hum,
      precip:    raw.precip,
      maxHrPrec: raw.maxHrPrec,
      maxWind:   raw.maxWind,
      avgWind:   raw.avgWind,
      soil:      raw.soil,
      pres:      raw.pres,
      cloud:     raw.cloud,
    }];
  }),
);

export function getDisasterCampById(campId) {
  const camp = CAMPS.find((item) => item.id === campId)
  if (!camp) return null
  return {
    ...camp,
    detail: CAMP_DETAIL[campId] || null,
  }
}

export function getDisasterCampSummaries() {
  return CAMPS.map((camp) => ({ ...camp }))
}

export function getDisasterDashboardSummary() {
  const statusCounts = CAMPS.reduce((counts, camp) => {
    counts[camp.status] = (counts[camp.status] || 0) + 1
    return counts
  }, {})

  return {
    camps: getDisasterCampSummaries(),
    map_nodes: CAMPS.map(({ id, code, name, lat, lng, status, type }) => ({ id, code, name, lat, lng, status, type })),
    total_displaced: CAMPS.reduce((sum, camp) => sum + camp.displaced, 0),
    total_workers: CAMPS.reduce((sum, camp) => sum + camp.workers, 0),
    status_counts: statusCounts,
  }
}

export function getDisasterMapNodes() {
  return CAMPS.map(({ id, code, name, lat, lng, status, type }) => ({ id, code, name, lat, lng, status, type }))
}
