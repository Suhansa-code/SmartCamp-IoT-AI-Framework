import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_PYTHON_PATH = path.resolve(
  __dirname,
  '../../../../edge-gateway/scripts/OpenStreet API/.venv/Scripts/python.exe',
)
const DEFAULT_GPS_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../edge-gateway/scripts/gps_module/main.py',
)
const DEFAULT_OPENSTREET_SCRIPT_PATH = path.resolve(
  __dirname,
  '../../../../edge-gateway/scripts/OpenStreet API/main.py',
)

function nmeaToDecimal(rawValue, hemisphere, isLatitude) {
  if (!rawValue) return null

  const degreesLength = isLatitude ? 2 : 3
  const degrees = Number(rawValue.slice(0, degreesLength))
  const minutes = Number(rawValue.slice(degreesLength))

  if (!Number.isFinite(degrees) || !Number.isFinite(minutes)) {
    return null
  }

  let decimal = degrees + minutes / 60
  if (hemisphere === 'S' || hemisphere === 'W') {
    decimal *= -1
  }

  return decimal
}

function parseGpsOutput(output) {
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed.startsWith('{')) {
      continue
    }

    try {
      const payload = JSON.parse(trimmed)
      const latitude = Number(payload.latitude ?? payload.lat)
      const longitude = Number(payload.longitude ?? payload.lng ?? payload.lon)
      const altitude = Number(payload.altitude ?? payload.alt ?? 0)

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        return { latitude, longitude, altitude: Number.isFinite(altitude) ? altitude : 0 }
      }
    } catch {
      continue
    }
  }

  const latitudeMatch = output.match(/Latitude:\s*([-+]?\d+(?:\.\d+)?)/i)
  const longitudeMatch = output.match(/Longitude:\s*([-+]?\d+(?:\.\d+)?)/i)

  if (latitudeMatch && longitudeMatch) {
    const latitude = Number(latitudeMatch[1])
    const longitude = Number(longitudeMatch[1])

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  const lines = output.split(/\r?\n/)

  for (const line of lines) {
    if (!line.includes('$GPGGA') && !line.includes('$GNGGA')) {
      continue
    }

    const parts = line.trim().split(',')
    const latitude = nmeaToDecimal(parts[2], parts[3], true)
    const longitude = nmeaToDecimal(parts[4], parts[5], false)

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude }
    }
  }

  return null
}

function readLiveGpsLocation() {
  const pythonExecutable = process.env.DISASTER_PYTHON_EXECUTABLE || DEFAULT_PYTHON_PATH
  const scriptPath = process.env.DISASTER_GPS_SCRIPT || DEFAULT_GPS_SCRIPT_PATH
  const timeoutMs = Number(process.env.DISASTER_GPS_TIMEOUT_MS || 12000)

  const child = spawnSync(pythonExecutable, [scriptPath], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12000,
    windowsHide: true,
  })

  if (child.error && child.error.code !== 'ETIMEDOUT') {
    return null
  }

  return parseGpsOutput(`${child.stdout || ''}\n${child.stderr || ''}`.trim())
}

function readLiveOpenStreetPayload(latitude, longitude, altitude) {
  const pythonExecutable = process.env.DISASTER_PYTHON_EXECUTABLE || DEFAULT_PYTHON_PATH
  const scriptPath = process.env.DISASTER_OPENSTREET_SCRIPT || DEFAULT_OPENSTREET_SCRIPT_PATH
  const timeoutMs = Number(process.env.DISASTER_OPENSTREET_TIMEOUT_MS || 60000)

  const child = spawnSync(
    pythonExecutable,
    [
      scriptPath,
      '--json',
      '--lat',
      String(latitude),
      '--lon',
      String(longitude),
      '--alt',
      String(altitude ?? 0),
    ],
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
      windowsHide: true,
    }
  )

  if (child.error && child.error.code !== 'ETIMEDOUT') {
    return null
  }

  const output = (child.stdout || '').trim()
  if (!output) {
    return null
  }

  try {
    return JSON.parse(output)
  } catch {
    return null
  }
}

function toNumber(value, fallback = null) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveLiveCampDetail(baseDetail, payload, gpsLocation) {
  const nearestRiver = payload?.nearest_river || {}
  const gaugingStation = payload?.gauging_station || {}
  const liveGaugeData = payload?.live_gauge_data || {}
  const forecastLocation = payload?.forecast?.forecast_location || {}
  const forecastSummary = payload?.forecast_summary || {}

  return {
    ...baseDetail,
    waterPath: nearestRiver.name || baseDetail.waterPath,
    river: gaugingStation.river_name || gaugingStation.river || liveGaugeData.basin || baseDetail.river,
    station: gaugingStation.station_name || liveGaugeData.gauge || baseDetail.station,
    stDist: toNumber(gaugingStation.distance_to_station_meters ?? gaugingStation.distance_meters, baseDetail.stDist),
    upDist: toNumber(gaugingStation.distance_to_river_meters, baseDetail.upDist),
    wl: toNumber(liveGaugeData.water_level, baseDetail.wl),
    rain: toNumber(liveGaugeData.rainfall, baseDetail.rain),
    alertL: toNumber(liveGaugeData.alert_level ?? gaugingStation.alert_level, baseDetail.alertL),
    minorL: toNumber(liveGaugeData.minor_flood_level ?? gaugingStation.minor_flood_level, baseDetail.minorL),
    majorL: toNumber(liveGaugeData.major_flood_level ?? gaugingStation.major_flood_level, baseDetail.majorL),
    gauLat: toNumber(liveGaugeData.latitude, baseDetail.gauLat),
    gauLng: toNumber(liveGaugeData.longitude, baseDetail.gauLng),
    fcLat: toNumber(forecastLocation.lat, baseDetail.fcLat),
    fcLng: toNumber(forecastLocation.lon, baseDetail.fcLng),
    elev: toNumber(forecastLocation.elevation, baseDetail.elev),
    minT: toNumber(forecastSummary.min_temp, baseDetail.minT),
    maxT: toNumber(forecastSummary.max_temp, baseDetail.maxT),
    hum: toNumber(forecastSummary.avg_humidity, baseDetail.hum),
    precip: toNumber(forecastSummary.total_precipitation, baseDetail.precip),
    maxHrPrec: toNumber(forecastSummary.max_hourly_precipitation, baseDetail.maxHrPrec),
    maxWind: toNumber(forecastSummary.max_wind_speed, baseDetail.maxWind),
    avgWind: toNumber(forecastSummary.avg_wind_speed, baseDetail.avgWind),
    soil: toNumber(forecastSummary.surface_soil_moisture, baseDetail.soil),
    pres: toNumber(forecastSummary.avg_pressure, baseDetail.pres),
    cloud: toNumber(forecastSummary.max_cloud_cover, baseDetail.cloud),
    live_query_lat: gpsLocation.latitude,
    live_query_lng: gpsLocation.longitude,
  }
}

function buildResolvedCampRegistry() {
  const liveLocation = readLiveGpsLocation()
  const livePayload = liveLocation
    ? readLiveOpenStreetPayload(liveLocation.latitude, liveLocation.longitude, liveLocation.altitude)
    : null

  return DISASTER_CAMPS.map((camp) => {
    if (camp.id.toLowerCase() !== 'live' || !liveLocation) {
      return camp
    }

    return {
      ...camp,
      lat: liveLocation.latitude,
      lng: liveLocation.longitude,
      detail: resolveLiveCampDetail(camp.detail, livePayload, liveLocation),
    }
  })
}

const DISASTER_CAMPS = [
  {
    id: 'galle',
    code: 'GAL',
    name: 'Galle Flood Emergency',
    district: 'Galle',
    region: 'South West Coast',
    lat: 6.03,
    lng: 80.22,
    status: 'critical',
    displaced: 3840,
    capacity: 4000,
    aid: 41,
    type: 'FLOOD',
    workers: 124,
    detail: {
      waterPath: 'Gin Ganga', river: 'Gin Ganga', station: 'Baddegama', stDist: 8420, upDist: 640, wl: -0.42, rain: 18, alertL: 4.5, minorL: 5.5, majorL: 7.0, gauLat: 6.06, gauLng: 80.19, fcLat: 6.04, fcLng: 80.22, elev: 4, minT: 25.1, maxT: 31.2, hum: 89, precip: 18.2, maxHrPrec: 4.1, maxWind: 22, avgWind: 9, soil: 0.38, pres: 1008, cloud: 90,
    },
  },
  {
    id: 'colombo',
    code: 'CMB',
    name: 'Colombo Urban Relief',
    district: 'Colombo',
    region: 'Western Province',
    lat: 6.92,
    lng: 79.86,
    status: 'medium',
    displaced: 540,
    capacity: 800,
    aid: 72,
    type: 'FLOOD',
    workers: 38,
    detail: {
      waterPath: 'Kelani Ganga', river: 'Kelani River', station: 'Nagalagam St.', stDist: 5500, upDist: 420, wl: 0.66, rain: 12, alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 6.94, gauLng: 79.88, fcLat: 6.92, fcLng: 79.86, elev: 8, minT: 26.5, maxT: 32.0, hum: 87, precip: 12.4, maxHrPrec: 3.2, maxWind: 20, avgWind: 8, soil: 0.33, pres: 1006, cloud: 85,
    },
  },
  {
    id: 'kurunegala',
    code: 'KUR',
    name: 'Kurunegala Relief',
    district: 'Kurunegala',
    region: 'North Western Province',
    lat: 7.48,
    lng: 80.37,
    status: 'recovery',
    displaced: 275,
    capacity: 500,
    aid: 94,
    type: 'FLOOD',
    workers: 21,
    detail: {
      waterPath: 'Deduru Oya', river: 'Deduru Oya', station: 'Kurunegala', stDist: 5600, upDist: 620, wl: 0.14, rain: 6, alertL: 4.0, minorL: 5.0, majorL: 7.0, gauLat: 7.49, gauLng: 80.35, fcLat: 7.48, fcLng: 80.37, elev: 116, minT: 26.0, maxT: 32.5, hum: 82, precip: 6.2, maxHrPrec: 1.4, maxWind: 11, avgWind: 4, soil: 0.27, pres: 1005, cloud: 70,
    },
  },
  {
    id: 'kandy',
    code: 'KDY',
    name: 'Kandy Landslide Relief',
    district: 'Kandy',
    region: 'Central Province',
    lat: 7.29,
    lng: 80.64,
    status: 'high',
    displaced: 1620,
    capacity: 2000,
    aid: 63,
    type: 'LANDSLIDE',
    workers: 76,
    detail: {
      waterPath: 'Heen Ganga', river: 'Mahaweli Ganga', station: 'Weraganthota', stDist: 20136, upDist: 1524, wl: -2.76, rain: 0, alertL: 5.0, minorL: 6.0, majorL: 8.0, gauLat: 7.3175, gauLng: 80.988, fcLat: 7.487, fcLng: 80.985, elev: 79, minT: 24.5, maxT: 30.3, hum: 91, precip: 6.5, maxHrPrec: 1.7, maxWind: 8, avgWind: 2, soil: 0.301, pres: 997, cloud: 100,
    },
  },
  {
    id: 'nuwara',
    code: 'NWE',
    name: 'Nuwara Eliya Landslide',
    district: 'Nuwara Eliya',
    region: 'Central Highlands',
    lat: 6.97,
    lng: 80.77,
    status: 'medium',
    displaced: 360,
    capacity: 500,
    aid: 76,
    type: 'LANDSLIDE',
    workers: 22,
    detail: {
      waterPath: 'Kotmale Oya', river: 'Mahaweli Ganga', station: 'Nuwara Eliya', stDist: 4300, upDist: 380, wl: 0.22, rain: 14, alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.97, gauLng: 80.77, fcLat: 6.97, fcLng: 80.77, elev: 1868, minT: 14.0, maxT: 20.5, hum: 95, precip: 14.0, maxHrPrec: 3.8, maxWind: 10, avgWind: 3, soil: 0.44, pres: 830, cloud: 100,
    },
  },
  {
    id: 'anuradhapura',
    code: 'ANU',
    name: 'Anuradhapura Relief',
    district: 'Anuradhapura',
    region: 'North Central Province',
    lat: 8.34,
    lng: 80.41,
    status: 'stable',
    displaced: 310,
    capacity: 600,
    aid: 88,
    type: 'DROUGHT',
    workers: 29,
    detail: {
      waterPath: 'Malwathu Oya', river: 'Malwathu Oya', station: 'Maradankadawala', stDist: 16500, upDist: 2400, wl: -2.10, rain: 0, alertL: 4.5, minorL: 5.5, majorL: 7.5, gauLat: 8.36, gauLng: 80.38, fcLat: 8.34, fcLng: 80.41, elev: 81, minT: 27.0, maxT: 35.5, hum: 70, precip: 1.0, maxHrPrec: 0.3, maxWind: 18, avgWind: 7, soil: 0.18, pres: 1011, cloud: 25,
    },
  },
  {
    id: 'jaffna',
    code: 'JFN',
    name: 'Jaffna Drought Relief',
    district: 'Jaffna',
    region: 'Northern Province',
    lat: 9.67,
    lng: 80.01,
    status: 'medium',
    displaced: 980,
    capacity: 1200,
    aid: 82,
    type: 'DROUGHT',
    workers: 54,
    detail: {
      waterPath: 'Jaffna Lagoon', river: 'Parangi Aru', station: 'Chavakachcheri', stDist: 11200, upDist: 1800, wl: -3.50, rain: 0, alertL: 2.0, minorL: 3.0, majorL: 4.0, gauLat: 9.65, gauLng: 80.03, fcLat: 9.67, fcLng: 80.01, elev: 5, minT: 29.0, maxT: 36.0, hum: 72, precip: 0.2, maxHrPrec: 0.1, maxWind: 28, avgWind: 12, soil: 0.14, pres: 1014, cloud: 20,
    },
  },
  {
    id: 'trinco',
    code: 'TRC',
    name: 'Trincomalee Flood Camp',
    district: 'Trincomalee',
    region: 'Eastern Province',
    lat: 8.58,
    lng: 81.22,
    status: 'stable',
    displaced: 620,
    capacity: 900,
    aid: 91,
    type: 'FLOOD',
    workers: 47,
    detail: {
      waterPath: 'Mahaweli Delta', river: 'Mahaweli Ganga', station: 'Manampitiya', stDist: 22400, upDist: 3200, wl: -1.80, rain: 2, alertL: 5.0, minorL: 6.5, majorL: 9.0, gauLat: 8.56, gauLng: 81.22, fcLat: 8.58, fcLng: 81.22, elev: 3, minT: 27.5, maxT: 34.0, hum: 80, precip: 2.4, maxHrPrec: 0.6, maxWind: 15, avgWind: 6, soil: 0.25, pres: 1011, cloud: 40,
    },
  },
  {
    id: 'batticaloa',
    code: 'BTC',
    name: 'Batticaloa Cyclone Camp',
    district: 'Batticaloa',
    region: 'Eastern Province',
    lat: 7.72,
    lng: 81.68,
    status: 'high',
    displaced: 2215,
    capacity: 2500,
    aid: 55,
    type: 'CYCLONE',
    workers: 88,
    detail: {
      waterPath: 'Batticaloa Lag.', river: 'Verugal Aru', station: 'Chenkalady', stDist: 14200, upDist: 820, wl: 1.12, rain: 6, alertL: 3.0, minorL: 4.0, majorL: 5.5, gauLat: 7.75, gauLng: 81.70, fcLat: 7.72, fcLng: 81.68, elev: 2, minT: 26.0, maxT: 32.8, hum: 84, precip: 6.0, maxHrPrec: 1.2, maxWind: 18, avgWind: 7, soil: 0.28, pres: 1010, cloud: 75,
    },
  },
  {
    id: 'hambantota',
    code: 'HMB',
    name: 'Hambantota Storm Camp',
    district: 'Hambantota',
    region: 'Southern Province',
    lat: 6.12,
    lng: 81.12,
    status: 'medium',
    displaced: 440,
    capacity: 600,
    aid: 69,
    type: 'STORM',
    workers: 28,
    detail: {
      waterPath: 'Walawe Ganga', river: 'Walawe River', station: 'Embilipitiya', stDist: 18000, upDist: 2100, wl: -0.30, rain: 8, alertL: 3.5, minorL: 4.5, majorL: 6.0, gauLat: 6.15, gauLng: 81.10, fcLat: 6.12, fcLng: 81.12, elev: 12, minT: 28.0, maxT: 34.5, hum: 78, precip: 8.0, maxHrPrec: 2.0, maxWind: 16, avgWind: 6, soil: 0.22, pres: 1010, cloud: 55,
    },
  },
  {
    id: 'LIVE',
    code: 'LIVE',
    name: 'LIVE Flood Relief',
    district: 'Live Test Camp',
    region: 'Live Region',
    lat: 6.68,
    lng: 80.40,
    status: 'high',
    displaced: 1190,
    capacity: 1500,
    aid: 58,
    type: 'FLOOD',
    workers: 49,
    detail: {
      waterPath: 'Kalu Ganga', river: 'Kalu Ganga', station: 'Ratnapura', stDist: 9400, upDist: 780, wl: 0.85, rain: 22, alertL: 4.2, minorL: 5.2, majorL: 6.8, gauLat: 6.69, gauLng: 80.39, fcLat: 6.68, fcLng: 80.40, elev: 31, minT: 25.6, maxT: 31.4, hum: 91, precip: 22.6, maxHrPrec: 4.6, maxWind: 19, avgWind: 8, soil: 0.41, pres: 1007, cloud: 88,
    },
  },
]

function resolveCampLocation(camp) {
  return camp
}

function toSummary(camp) {
  const { detail, ...summary } = resolveCampLocation(camp)
  return summary
}

function toMapNode(camp) {
  const liveCamp = resolveCampLocation(camp)

  return {
    id: liveCamp.id,
    code: liveCamp.code,
    name: liveCamp.name,
    district: liveCamp.district,
    region: liveCamp.region,
    lat: liveCamp.lat,
    lng: liveCamp.lng,
    status: liveCamp.status,
    type: liveCamp.type,
  }
}

export function getDisasterCampSummaries() {
  return buildResolvedCampRegistry().map(toSummary)
}

export function getDisasterMapNodes() {
  return buildResolvedCampRegistry().map(toMapNode)
}

export function getDisasterCampById(campId) {
  if (!campId) return null
  const normalized = String(campId).toLowerCase()
  return buildResolvedCampRegistry().find((camp) => camp.id.toLowerCase() === normalized) || null
}

export function getDisasterDashboardSummary() {
  const camps = buildResolvedCampRegistry().map(toSummary)
  const statusCounts = camps.reduce((accumulator, camp) => {
    accumulator[camp.status] = (accumulator[camp.status] || 0) + 1
    return accumulator
  }, {})

  return {
    source: 'static-disaster-management-registry',
    generated_at: new Date().toISOString(),
    total_camps: camps.length,
    total_displaced: camps.reduce((sum, camp) => sum + camp.displaced, 0),
    total_capacity: camps.reduce((sum, camp) => sum + camp.capacity, 0),
    total_workers: camps.reduce((sum, camp) => sum + camp.workers, 0),
    critical_camps: camps.filter((camp) => camp.status === 'critical').length,
    status_counts: statusCounts,
    camps,
    map_nodes: camps.map(toMapNode),
  }
}
