export const STATUS_META = {
  critical: { label: 'CRITICAL' },
  high: { label: 'HIGH' },
  medium: { label: 'MEDIUM' },
  stable: { label: 'STABLE' },
  recovery: { label: 'RECOVERY' },
}

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

export const CAMP_DETAIL = {
  galle: { waterPath: 'Gin Ganga', river: 'Gin Ganga', station: 'Baddegama', stDist: 8420, upDist: 640, wl: -0.42, rain: 18, alertL: 4.5, minorL: 5.5, majorL: 7.0, gauLat: 6.06, gauLng: 80.19, fcLat: 6.04, fcLng: 80.22, elev: 4, minT: 25.1, maxT: 31.2, hum: 89, precip: 18.2, maxHrPrec: 4.1, maxWind: 22, avgWind: 9, soil: 0.38, pres: 1008, cloud: 90 },
  batticaloa: { waterPath: 'Batticaloa Lag.', river: 'Verugal Aru', station: 'Chenkalady', stDist: 14200, upDist: 820, wl: 1.12, rain: 6, alertL: 3.0, minorL: 4.0, majorL: 5.5, gauLat: 7.75, gauLng: 81.70, fcLat: 7.72, fcLng: 81.68, elev: 2, minT: 26.0, maxT: 32.8, hum: 84, precip: 6.0, maxHrPrec: 1.2, maxWind: 18, avgWind: 7, soil: 0.28, pres: 1010, cloud: 75 },
  kandy: { waterPath: 'Heen Ganga', river: 'Mahaweli Ganga', station: 'Weraganthota', stDist: 20136, upDist: 1524, wl: -2.76, rain: 0, alertL: 5.0, minorL: 6.0, majorL: 8.0, gauLat: 7.3175, gauLng: 80.988, fcLat: 7.487, fcLng: 80.985, elev: 79, minT: 24.5, maxT: 30.3, hum: 91, precip: 6.5, maxHrPrec: 1.7, maxWind: 8, avgWind: 2, soil: 0.301, pres: 997, cloud: 100 },
  ratnapura: { waterPath: 'Kalu Ganga', river: 'Kalu Ganga', station: 'Ratnapura', stDist: 3200, upDist: 280, wl: 2.14, rain: 42, alertL: 5.5, minorL: 6.5, majorL: 8.5, gauLat: 6.70, gauLng: 80.40, fcLat: 6.68, fcLng: 80.40, elev: 18, minT: 23.8, maxT: 29.4, hum: 94, precip: 42.0, maxHrPrec: 9.8, maxWind: 12, avgWind: 4, soil: 0.42, pres: 993, cloud: 100 },
  ampara: { waterPath: 'Amparai Tank', river: 'Amparai Aru', station: 'Ampara', stDist: 6800, upDist: 950, wl: 0.88, rain: 4, alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 7.32, gauLng: 81.68, fcLat: 7.30, fcLng: 81.50, elev: 35, minT: 27.2, maxT: 33.5, hum: 80, precip: 4.2, maxHrPrec: 0.8, maxWind: 14, avgWind: 5, soil: 0.24, pres: 1012, cloud: 60 },
  colombo: { waterPath: 'Kelani Ganga', river: 'Kelani River', station: 'Nagalagam St.', stDist: 5500, upDist: 420, wl: 0.66, rain: 12, alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 6.94, gauLng: 79.88, fcLat: 6.92, fcLng: 79.86, elev: 8, minT: 26.5, maxT: 32.0, hum: 87, precip: 12.4, maxHrPrec: 3.2, maxWind: 20, avgWind: 8, soil: 0.33, pres: 1006, cloud: 85 },
  matara: { waterPath: 'Nilwala Ganga', river: 'Nilwala Ganga', station: 'Pitabeddara', stDist: 9100, upDist: 760, wl: -1.10, rain: 22, alertL: 4.0, minorL: 5.0, majorL: 6.5, gauLat: 5.99, gauLng: 80.55, fcLat: 5.97, fcLng: 80.54, elev: 6, minT: 25.8, maxT: 31.0, hum: 90, precip: 22.0, maxHrPrec: 5.5, maxWind: 25, avgWind: 11, soil: 0.36, pres: 1005, cloud: 95 },
  hambantota: { waterPath: 'Walawe Ganga', river: 'Walawe River', station: 'Embilipitiya', stDist: 18000, upDist: 2100, wl: -0.30, rain: 8, alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.15, gauLng: 81.10, fcLat: 6.12, fcLng: 81.12, elev: 12, minT: 28.0, maxT: 34.5, hum: 78, precip: 8.0, maxHrPrec: 2.0, maxWind: 16, avgWind: 6, soil: 0.22, pres: 1010, cloud: 55 },
  jaffna: { waterPath: 'Jaffna Lagoon', river: 'Parangi Aru', station: 'Chavakachcheri', stDist: 11200, upDist: 1800, wl: -3.50, rain: 0, alertL: 2.0, minorL: 3.0, majorL: 4.0, gauLat: 9.65, gauLng: 80.03, fcLat: 9.67, fcLng: 80.01, elev: 5, minT: 29.0, maxT: 36.0, hum: 72, precip: 0.2, maxHrPrec: 0.1, maxWind: 28, avgWind: 12, soil: 0.14, pres: 1014, cloud: 20 },
  nuwara: { waterPath: 'Kotmale Oya', river: 'Mahaweli Ganga', station: 'Nuwara Eliya', stDist: 4300, upDist: 380, wl: 0.22, rain: 14, alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.97, gauLng: 80.77, fcLat: 6.97, fcLng: 80.77, elev: 1868, minT: 14.0, maxT: 20.5, hum: 95, precip: 14.0, maxHrPrec: 3.8, maxWind: 10, avgWind: 3, soil: 0.44, pres: 830, cloud: 100 },
  trinco: { waterPath: 'Mahaweli Delta', river: 'Mahaweli Ganga', station: 'Manampitiya', stDist: 22400, upDist: 3200, wl: -1.80, rain: 2, alertL: 5.0, minorL: 6.5, majorL: 9.0, gauLat: 8.56, gauLng: 81.22, fcLat: 8.58, fcLng: 81.22, elev: 3, minT: 27.5, maxT: 34.0, hum: 80, precip: 2.4, maxHrPrec: 0.6, maxWind: 15, avgWind: 6, soil: 0.25, pres: 1011, cloud: 40 },
  anuradhapura: { waterPath: 'Malwathu Oya', river: 'Malwathu Oya', station: 'Maradankadawala', stDist: 16500, upDist: 2400, wl: -2.10, rain: 0, alertL: 4.5, minorL: 5.5, majorL: 7.5, gauLat: 8.36, gauLng: 80.38, fcLat: 8.34, fcLng: 80.41, elev: 81, minT: 27.0, maxT: 35.5, hum: 70, precip: 1.0, maxHrPrec: 0.3, maxWind: 18, avgWind: 7, soil: 0.18, pres: 1011, cloud: 25 },
  vavuniya: { waterPath: 'Iranamadu Tank', river: 'Parangi Aru', station: 'Vavuniya', stDist: 7800, upDist: 1100, wl: -1.40, rain: 1, alertL: 3.0, minorL: 4.0, majorL: 5.5, gauLat: 8.74, gauLng: 80.51, fcLat: 8.76, fcLng: 80.50, elev: 98, minT: 28.5, maxT: 36.0, hum: 68, precip: 1.2, maxHrPrec: 0.4, maxWind: 20, avgWind: 8, soil: 0.16, pres: 1012, cloud: 18 },
  kurunegala: { waterPath: 'Deduru Oya', river: 'Deduru Oya', station: 'Kurunegala', stDist: 5600, upDist: 620, wl: 0.14, rain: 6, alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 7.49, gauLng: 80.35, fcLat: 7.48, fcLng: 80.37, elev: 116, minT: 26.0, maxT: 32.5, hum: 82, precip: 6.2, maxHrPrec: 1.4, maxWind: 11, avgWind: 4, soil: 0.27, pres: 1005, cloud: 70 },
}

export const DONUT_SEGS = [
  { pct: 33, label: '33%', code: 'FLOOD' },
  { pct: 22, label: '22%', code: 'STORM' },
  { pct: 19, label: '19%', code: 'LANDSLIDE' },
  { pct: 15, label: '15%', code: 'CYCLONE' },
  { pct: 7, label: '7%', code: 'DROUGHT' },
  { pct: 4, label: '4%', code: 'OTHER' },
]

export const DISPLACED_SPARK = [1800, 2100, 2350, 2200, 2600, 2850, 2700, 3100, 3350, 3150, 3000, 2850, 2950, 3150, 3450, 3600, 3200, 3050, 3350, 3500]
export const AIDED_SPARK = [900, 1100, 1350, 1550, 1700, 1600, 1900, 2100, 2400, 2350, 2650, 2800, 2700, 3000, 2950, 3150, 3400, 3500, 3350, 3620]
export const TREND_DATA = [820, 960, 750, 1100, 980, 1200, 1050, 1300, 1150, 1420, 1260, 1100, 1380, 1520, 1310, 1460, 1610, 1400, 1560, 1710, 1982]

export function statusColor(status, theme) {
  return { critical: theme.red, high: theme.orange, medium: theme.yellow, stable: theme.cyan, recovery: theme.green }[status] || theme.cyan
}

export function getCampById(campId) {
  return CAMPS.find((camp) => camp.id === campId) || null
}
