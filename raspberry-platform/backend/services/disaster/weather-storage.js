/**
 * weather-storage.js — Persists weather forecasts from the HEDGE Gateway into disaster.db.
 *
 * Fetches weather data through the Edge Gateway's /hydrospatial/weather endpoint
 * (which wraps Open-Meteo). Uses the latest persisted GPS location from the
 * gps_readings table. Implements three fetch conditions:
 *
 *   1. 30 minutes elapsed since last successful fetch.
 *   2. GPS location changed significantly from the location used for the previous fetch.
 *   3. A previous fetch was missed (connectivity unavailable), and connectivity is now restored.
 *
 * Follows the same pattern as gps-storage.js: self-rescheduling setTimeout,
 * start/stop/status exports, and [WEATHER] prefixed logging.
 */
import { disasterDb } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import { nowISO } from '../../utils/helpers.js';
import { haversineDistance } from './gps-storage.js';

const DEVICE_ID = C.DEVICE_ID;
const EDGE_API = process.env.EDGE_API_URL || 'http://127.0.0.1:8000';

// ── Config ──────────────────────────────────────────────────────────────

const INTERVAL_MS = (C.WEATHER_FETCH_INTERVAL_MINUTES || 30) * 60_000;
const LOCATION_THRESHOLD_M = C.WEATHER_LOCATION_THRESHOLD_METERS || 500;

// ── State ───────────────────────────────────────────────────────────────

let timer = null;
let lastFetchTime = null;         // timestamp of last SUCCESSFUL fetch
let lastFetchLat = null;          // lat used for last successful fetch
let lastFetchLng = null;          // lng used for last successful fetch
let pendingFetch = false;         // true when a fetch was missed

// ── Prepared statements (lazy init) ─────────────────────────────────────

let insertStmt = null;

function ensureStatements() {
  if (insertStmt) return;
  insertStmt = disasterDb.prepare(`
    INSERT INTO weather_data
      (device_id, latitude, longitude, temperature, humidity, precipitation, rainfall,
       wind_speed, wind_direction, weather_code, condition, forecast_data, forecast_time,
       source, fetched_at, created_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function isValidCoord(lat, lng) {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

/**
 * WMO weather code → human-readable condition string.
 * https://www.nodc.noaa.gov/archive/arc0021/0002199/1.1/data/0-data/HTML/WMO-CODE/WMO4677.HTM
 */
function weatherCodeToCondition(code) {
  if (code == null) return null;
  const map = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog',
    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
    56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
    66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Slight snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
  };
  return map[code] || `Code ${code}`;
}

/**
 * Get the latest persisted GPS location from disaster.db.
 * Returns { latitude, longitude } or null.
 */
function getLatestPersistedGps() {
  try {
    const row = disasterDb
      .prepare('SELECT latitude, longitude FROM gps_readings ORDER BY id DESC LIMIT 1')
      .get();
    if (row && isValidCoord(row.latitude, row.longitude)) {
      return { latitude: row.latitude, longitude: row.longitude };
    }
  } catch (err) {
    logger.warn(`[WEATHER] Failed to read GPS from DB: ${err.message}`);
  }
  return null;
}

/**
 * Get the latest successfully saved weather record from disaster.db.
 * Returns the row or null.
 */
function getLatestWeatherRecord() {
  try {
    return disasterDb
      .prepare('SELECT * FROM weather_data ORDER BY id DESC LIMIT 1')
      .get();
  } catch (_) {
    return null;
  }
}

/**
 * Fetch weather forecast from the HEDGE Gateway.
 * Returns { data, error }.
 */
async function fetchWeatherFromGateway(lat, lng) {
  try {
    const url = `${EDGE_API}/hydrospatial/weather?lat=${lat}&lon=${lng}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) {
      return { data: null, error: `Gateway returned ${response.status}` };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

/**
 * Extract summary values from the Open-Meteo hourly forecast response.
 * Returns a flat object suitable for the weather_data table.
 */
function extractWeatherSummary(gatewayResponse) {
  const hourly = gatewayResponse?.weather_forecast_parameters?.hourly || {};
  const temps = hourly.temperature_2m || [];
  const hums = hourly.relative_humidity_2m || [];
  const precip = hourly.precipitation || [];
  const rain = hourly.rain || [];
  const windSpeeds = hourly.wind_speed_10m || [];
  const windDirs = hourly.wind_direction_10m || [];
  const codes = hourly.weather_code || [];

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + (v ?? 0), 0) / arr.length : null;
  const max = (arr) => arr.length ? Math.max(...arr.map(v => v ?? 0)) : null;
  const sum = (arr) => arr.reduce((s, v) => s + (v ?? 0), 0);

  // Use the most common weather code (mode) as the representative condition
  const mode = (arr) => {
    if (!arr.length) return null;
    const freq = {};
    arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]);
  };

  const weatherCode = mode(codes);

  return {
    temperature: avg(temps),
    humidity: avg(hums),
    precipitation: sum(precip),
    rainfall: sum(rain),
    wind_speed: max(windSpeeds),
    wind_direction: avg(windDirs),
    weather_code: weatherCode,
    condition: weatherCodeToCondition(weatherCode),
    forecast_time: gatewayResponse?.forecast_location
      ? `${gatewayResponse.forecast_location.timezone || 'UTC'}`
      : null,
  };
}

// ── Core fetch + save logic ─────────────────────────────────────────────

/**
 * Perform a weather fetch and save to DB.
 * Returns true if a record was inserted, false otherwise.
 */
async function fetchAndSaveWeather() {
  ensureStatements();

  const gps = getLatestPersistedGps();
  if (!gps) {
    logger.info('[WEATHER] No valid GPS location in DB — skipping');
    return false;
  }

  const { latitude: lat, longitude: lng } = gps;
  const now = Date.now();

  // ── Condition 1: 30 minutes elapsed ────────────────────────────────
  const elapsed = lastFetchTime ? (now - lastFetchTime) >= INTERVAL_MS : true;

  // ── Condition 2: Location changed significantly ────────────────────
  let locationChanged = false;
  if (lastFetchLat != null && lastFetchLng != null) {
    const dist = haversineDistance(lastFetchLat, lastFetchLng, lat, lng);
    locationChanged = dist >= LOCATION_THRESHOLD_M;
  }

  // ── Condition 3: Pending missed fetch ──────────────────────────────
  const shouldFetch = elapsed || locationChanged || pendingFetch;

  if (!shouldFetch) {
    logger.debug('[WEATHER] No fetch needed (interval not elapsed, no significant movement, no pending fetch)');
    return false;
  }

  const reason = elapsed ? 'interval_elapsed' : locationChanged ? 'location_changed' : 'pending_recovery';
  logger.info(`[WEATHER] Fetching weather — reason: ${reason}, lat=${lat.toFixed(4)}, lng=${lng.toFixed(4)}`);

  const { data, error } = await fetchWeatherFromGateway(lat, lng);

  if (error || !data) {
    logger.warn(`[WEATHER] Fetch failed: ${error || 'no data'} — marking pending`);
    pendingFetch = true;
    return false;
  }

  // ── Extract and save ───────────────────────────────────────────────
  const summary = extractWeatherSummary(data);
  const fetchedAt = nowISO();
  const forecastData = JSON.stringify(data);

  try {
    insertStmt.run(
      DEVICE_ID,
      Math.round(lat * 10000) / 10000,
      Math.round(lng * 10000) / 10000,
      summary.temperature,
      summary.humidity,
      summary.precipitation,
      summary.rainfall,
      summary.wind_speed,
      summary.wind_direction,
      summary.weather_code,
      summary.condition,
      forecastData,
      summary.forecast_time,
      'open-meteo',
      fetchedAt,
      fetchedAt,
    );

    // Update state only on success
    lastFetchTime = Date.now();
    lastFetchLat = lat;
    lastFetchLng = lng;
    pendingFetch = false;

    logger.info(`[WEATHER] Saved: temp=${summary.temperature?.toFixed(1)}°C, humidity=${summary.humidity?.toFixed(0)}%, condition="${summary.condition}"`);
    return true;
  } catch (err) {
    logger.error(`[WEATHER] DB insert failed: ${err.message}`);
    pendingFetch = true;
    return false;
  }
}

// ── Periodic timer (self-rescheduling, like gps-storage.js) ────────────

function scheduleNextTick() {
  timer = setTimeout(async () => {
    logger.info(`[WEATHER] Timer tick — interval: ${INTERVAL_MS}ms (${INTERVAL_MS / 60_000} min)`);
    try {
      const saved = await fetchAndSaveWeather();
      if (saved) {
        logger.info(`[WEATHER] Save successful — next fetch in ${INTERVAL_MS / 60_000} minutes`);
      } else {
        logger.debug('[WEATHER] No save this tick — will retry next interval');
      }
    } catch (err) {
      logger.error(`[WEATHER] Tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, INTERVAL_MS);
}

// ── Startup: check if overdue ───────────────────────────────────────────

function checkStartupOverdue() {
  const last = getLatestWeatherRecord();
  if (!last) {
    logger.info('[WEATHER] No existing weather record — will fetch after GPS becomes available');
    return;
  }

  // Seed state from the last successful record
  lastFetchLat = last.latitude;
  lastFetchLng = last.longitude;

  if (last.fetched_at) {
    try {
      const fetchedMs = new Date(last.fetched_at).getTime();
      if (Number.isFinite(fetchedMs)) {
        lastFetchTime = fetchedMs;
        const elapsed = Date.now() - fetchedMs;
        if (elapsed >= INTERVAL_MS) {
          logger.info(`[WEATHER] Overdue by ${Math.round(elapsed / 60_000)} min — will fetch immediately`);
          pendingFetch = true;
        } else {
          const remaining = Math.round((INTERVAL_MS - elapsed) / 60_000);
          logger.info(`[WEATHER] Last fetch ${Math.round(elapsed / 60_000)} min ago — next in ~${remaining} min`);
        }
      }
    } catch (_) { /* ignore parse errors */ }
  }
}

// ── Public API ──────────────────────────────────────────────────────────

export function startWeatherStorage() {
  if (timer) {
    logger.warn('[WEATHER] Already running');
    return;
  }

  ensureStatements();
  checkStartupOverdue();

  // First tick after a short delay (after GPS storage has had time to seed)
  setTimeout(async () => {
    logger.info('[WEATHER] Initial tick');
    try {
      const saved = await fetchAndSaveWeather();
      logger.info(`[WEATHER] Initial tick result: ${saved ? 'saved' : 'no save'}`);
    } catch (err) {
      logger.error(`[WEATHER] Initial tick error: ${err.message}`);
    }
    scheduleNextTick();
  }, 5_000);

  logger.info(`[WEATHER] Started (interval: ${INTERVAL_MS}ms = ${INTERVAL_MS / 60_000} min, location threshold: ${LOCATION_THRESHOLD_M}m)`);
}

export function stopWeatherStorage() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  logger.info('[WEATHER] Stopped');
}

export function getWeatherStorageStatus() {
  return {
    running: !!timer,
    interval_ms: INTERVAL_MS,
    interval_minutes: INTERVAL_MS / 60_000,
    location_threshold_m: LOCATION_THRESHOLD_M,
    last_fetch_time: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
    last_fetch_location: lastFetchLat != null ? { latitude: lastFetchLat, longitude: lastFetchLng } : null,
    pending_fetch: pendingFetch,
  };
}

/**
 * Get the latest weather record from the database.
 * Used by the controller to serve the frontend.
 */
export function getLatestWeather() {
  try {
    const row = disasterDb
      .prepare('SELECT * FROM weather_data ORDER BY id DESC LIMIT 1')
      .get();
    if (!row) return null;

    // Parse forecast_data JSON if present
    let forecastData = null;
    if (row.forecast_data) {
      try { forecastData = JSON.parse(row.forecast_data); } catch (_) {}
    }

    return {
      id: row.id,
      device_id: row.device_id,
      latitude: row.latitude,
      longitude: row.longitude,
      temperature: row.temperature,
      humidity: row.humidity,
      precipitation: row.precipitation,
      rainfall: row.rainfall,
      wind_speed: row.wind_speed,
      wind_direction: row.wind_direction,
      weather_code: row.weather_code,
      condition: row.condition,
      forecast_time: row.forecast_time,
      source: row.source,
      fetched_at: row.fetched_at,
      created_at: row.created_at,
      forecast: forecastData,
    };
  } catch (err) {
    logger.error(`[WEATHER] getLatestWeather failed: ${err.message}`);
    return null;
  }
}
