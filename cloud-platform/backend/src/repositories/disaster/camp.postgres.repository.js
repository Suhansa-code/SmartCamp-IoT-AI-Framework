/**
 * Disaster domain repository — PostgreSQL implementation.
 *
 * Reads disaster camps from the shared PostgreSQL pool (table "CAMPS").
 * Mirrors the exact function/field contract of the in-memory repository
 * (repositories/disaster/camp.memory.repository.js) so controllers never
 * change when switching between them. All functions return promises.
 */
import { getPool } from '../../config/database.js';

const CAMP_COLUMNS = `
  id, code, name, lat, lng, status, displaced, capacity, aid, type, workers,
  water_path, river, station, st_dist, up_dist, wl, rain, alert_l, minor_l, major_l,
  gau_lat, gau_lng, fc_lat, fc_lng, elev, min_t, max_t, hum, precip, max_hr_prec,
  max_wind, avg_wind, soil, pres, cloud
`;

function toNumber(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toCampSummary(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    status: row.status,
    displaced: toInt(row.displaced),
    capacity: toInt(row.capacity),
    aid: toInt(row.aid),
    type: row.type,
    workers: toInt(row.workers),
  };
}

function toCampDetail(row) {
  return {
    waterPath: row.water_path ?? null,
    river: row.river ?? null,
    station: row.station ?? null,
    stDist: toNumber(row.st_dist),
    upDist: toNumber(row.up_dist),
    wl: toNumber(row.wl),
    rain: toNumber(row.rain),
    alertL: toNumber(row.alert_l),
    minorL: toNumber(row.minor_l),
    majorL: toNumber(row.major_l),
    gauLat: toNumber(row.gau_lat),
    gauLng: toNumber(row.gau_lng),
    fcLat: toNumber(row.fc_lat),
    fcLng: toNumber(row.fc_lng),
    elev: toNumber(row.elev),
    minT: toNumber(row.min_t),
    maxT: toNumber(row.max_t),
    hum: toNumber(row.hum),
    precip: toNumber(row.precip),
    maxHrPrec: toNumber(row.max_hr_prec),
    maxWind: toNumber(row.max_wind),
    avgWind: toNumber(row.avg_wind),
    soil: toNumber(row.soil),
    pres: toNumber(row.pres),
    cloud: toNumber(row.cloud),
  };
}

function toMapNode(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    status: row.status,
    type: row.type,
  };
}

async function queryAllCamps() {
  const result = await getPool().query(`SELECT ${CAMP_COLUMNS} FROM "CAMPS" ORDER BY id`);
  return result.rows;
}

export async function getDisasterCampById(campId) {
  const result = await getPool().query(`SELECT ${CAMP_COLUMNS} FROM "CAMPS" WHERE id = $1`, [campId]);
  const row = result.rows[0];
  if (!row) return null;
  return { ...toCampSummary(row), detail: toCampDetail(row) };
}

export async function getDisasterCampSummaries() {
  const rows = await queryAllCamps();
  return rows.map(toCampSummary);
}

export async function getDisasterMapNodes() {
  const rows = await queryAllCamps();
  return rows.map(toMapNode);
}

export async function getDisasterDashboardSummary() {
  const rows = await queryAllCamps();

  const statusCounts = {};
  let totalDisplaced = 0;
  let totalWorkers = 0;
  for (const row of rows) {
    statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    totalDisplaced += toInt(row.displaced);
    totalWorkers += toInt(row.workers);
  }

  return {
    camps: rows.map(toCampSummary),
    map_nodes: rows.map(toMapNode),
    total_displaced: totalDisplaced,
    total_workers: totalWorkers,
    status_counts: statusCounts,
  };
}

/**
 * Upserts camps (summary + detail). Used by `npm run db:seed`.
 * Accepts entries shaped like { ...summary, detail: { ...CAMP_DETAIL } }.
 */
export async function syncCamps(camps) {
  for (const camp of camps) {
    const d = camp.detail || {};
    await getPool().query(
      `INSERT INTO "CAMPS" (
         id, code, name, lat, lng, status, displaced, capacity, aid, type, workers,
         water_path, river, station, st_dist, up_dist, wl, rain, alert_l, minor_l, major_l,
         gau_lat, gau_lng, fc_lat, fc_lng, elev, min_t, max_t, hum, precip, max_hr_prec,
         max_wind, avg_wind, soil, pres, cloud
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
         $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
         $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
         $32, $33, $34, $35, $36
       )
       ON CONFLICT (id) DO UPDATE SET
         code       = EXCLUDED.code,
         name       = EXCLUDED.name,
         lat        = EXCLUDED.lat,
         lng        = EXCLUDED.lng,
         status     = EXCLUDED.status,
         displaced  = EXCLUDED.displaced,
         capacity   = EXCLUDED.capacity,
         aid        = EXCLUDED.aid,
         type       = EXCLUDED.type,
         workers    = EXCLUDED.workers,
         water_path = EXCLUDED.water_path,
         river      = EXCLUDED.river,
         station    = EXCLUDED.station,
         st_dist    = EXCLUDED.st_dist,
         up_dist    = EXCLUDED.up_dist,
         wl         = EXCLUDED.wl,
         rain       = EXCLUDED.rain,
         alert_l    = EXCLUDED.alert_l,
         minor_l    = EXCLUDED.minor_l,
         major_l    = EXCLUDED.major_l,
         gau_lat    = EXCLUDED.gau_lat,
         gau_lng    = EXCLUDED.gau_lng,
         fc_lat     = EXCLUDED.fc_lat,
         fc_lng     = EXCLUDED.fc_lng,
         elev       = EXCLUDED.elev,
         min_t      = EXCLUDED.min_t,
         max_t      = EXCLUDED.max_t,
         hum        = EXCLUDED.hum,
         precip     = EXCLUDED.precip,
         max_hr_prec = EXCLUDED.max_hr_prec,
         max_wind   = EXCLUDED.max_wind,
         avg_wind   = EXCLUDED.avg_wind,
         soil       = EXCLUDED.soil,
         pres       = EXCLUDED.pres,
         cloud      = EXCLUDED.cloud`,
      [camp.id, camp.code, camp.name, camp.lat, camp.lng, camp.status, camp.displaced, camp.capacity,
       camp.aid, camp.type, camp.workers, d.waterPath ?? null, d.river ?? null, d.station ?? null,
       d.stDist ?? null, d.upDist ?? null, d.wl ?? null, d.rain ?? null, d.alertL ?? null,
       d.minorL ?? null, d.majorL ?? null, d.gauLat ?? null, d.gauLng ?? null, d.fcLat ?? null,
       d.fcLng ?? null, d.elev ?? null, d.minT ?? null, d.maxT ?? null, d.hum ?? null,
       d.precip ?? null, d.maxHrPrec ?? null, d.maxWind ?? null, d.avgWind ?? null,
       d.soil ?? null, d.pres ?? null, d.cloud ?? null],
    );
  }
  return camps.length;
}