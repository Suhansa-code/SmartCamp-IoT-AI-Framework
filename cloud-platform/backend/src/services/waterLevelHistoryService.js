const EDGE_GATEWAY_BASE_URL = process.env.DISASTER_EDGE_GATEWAY_BASE_URL || 'http://localhost:5000'
const EDGE_GATEWAY_HISTORY_PATH = process.env.DISASTER_EDGE_WATER_LEVEL_HISTORY_PATH || '/gauging-station-water-level-history'
const ARC_GIS_BASE_URL = 'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query'

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toIsoTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }

  return new Date().toISOString()
}

function normalizePoint(item) {
  if (!item || typeof item !== 'object') return null

  const waterLevel =
    toNumber(item.water_level) ??
    toNumber(item.waterLevel) ??
    toNumber(item.level) ??
    toNumber(item.current_water_level)

  if (waterLevel === null) return null

  const timestampRaw = item.timestamp ?? item.time ?? item.updated_at ?? item.updatedAt ?? item.date ?? item.EditDate

  return {
    water_level: waterLevel,
    timestamp: toIsoTimestamp(timestampRaw),
  }
}

function normalizeHistoryPayload(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizePoint).filter(Boolean)
  }

  if (payload && typeof payload === 'object') {
    const candidates = [payload.history, payload.points, payload.data, payload.records, payload.measurements]
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizePoint).filter(Boolean)
      }
    }
  }

  return []
}

async function fetchJson(url) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchFromEdgeGateway(stationName, limit) {
  const encoded = encodeURIComponent(stationName)
  const candidateUrls = [
    `${EDGE_GATEWAY_BASE_URL}${EDGE_GATEWAY_HISTORY_PATH}?station=${encoded}&hours=${limit}`,
    `${EDGE_GATEWAY_BASE_URL}${EDGE_GATEWAY_HISTORY_PATH}?station_name=${encoded}&hours=${limit}`,
    `${EDGE_GATEWAY_BASE_URL}${EDGE_GATEWAY_HISTORY_PATH}?gauge=${encoded}&limit=${limit}`,
  ]

  for (const url of candidateUrls) {
    try {
      const payload = await fetchJson(url)
      const points = normalizeHistoryPayload(payload)
      if (points.length > 0) {
        return {
          source: 'edge-gateway',
          points: points.slice(-limit),
        }
      }
    } catch {
      // try next candidate URL
    }
  }

  throw new Error('No usable history from edge-gateway API')
}

async function fetchFromArcGis(stationName, limit) {
  const query = new URLSearchParams({
    where: `gauge='${stationName}'`,
    outFields: 'gauge,water_level,EditDate',
    orderByFields: 'EditDate DESC',
    resultRecordCount: String(limit),
    returnGeometry: 'false',
    f: 'json',
  })

  const payload = await fetchJson(`${ARC_GIS_BASE_URL}?${query.toString()}`)
  const features = Array.isArray(payload?.features) ? payload.features : []
  const points = features
    .map((feature) => normalizePoint(feature?.attributes || {}))
    .filter(Boolean)
    .reverse()

  return {
    source: 'arcgis-gauges-service',
    points,
  }
}

export async function getWaterLevelHistoryForCamp(camp, { hours = 8 } = {}) {
  const stationName = camp?.detail?.station
  if (!stationName) {
    throw new Error('No gauging station configured for this camp')
  }

  const limit = Math.max(4, Math.min(24, Number(hours) || 8))

  try {
    const edgeResult = await fetchFromEdgeGateway(stationName, limit)
    return {
      station: stationName,
      source: edgeResult.source,
      points: edgeResult.points,
    }
  } catch {
    const fallback = await fetchFromArcGis(stationName, limit)
    return {
      station: stationName,
      source: fallback.source,
      points: fallback.points,
    }
  }
}
