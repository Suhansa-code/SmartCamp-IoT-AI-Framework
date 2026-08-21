/**
 * PostgreSQL alert repository — writes education domain data to the cloud
 * database. Used by seed.js and alertSync.service when DB_ENABLED=true.
 */
import { getPool } from '../../config/database.js';

export async function syncChildren(childList) {
  const pool = getPool();
  let count = 0;
  for (const child of childList) {
    if (!child.child_id) continue;
    await pool.query(
      `INSERT INTO children (child_id, res_id, camp_id, grade, language, baseline_score, total_sessions, alert_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (child_id) DO UPDATE SET
         res_id = EXCLUDED.res_id,
         camp_id = EXCLUDED.camp_id,
         grade = EXCLUDED.grade,
         language = EXCLUDED.language,
         baseline_score = EXCLUDED.baseline_score,
         total_sessions = EXCLUDED.total_sessions,
         alert_status = EXCLUDED.alert_status`,
      [child.child_id, child.res_id || null, child.camp_id || null, child.grade || null, child.language || null, child.baseline_score || null, child.total_sessions || 0, child.alert_status || 'normal'],
    );
    count++;
  }
  return count;
}

export async function syncSessions(sessionList) {
  const pool = getPool();
  let count = 0;
  for (const session of sessionList) {
    if (!session.session_id) continue;
    await pool.query(
      `INSERT INTO sessions (session_id, child_id, composite_score, anomaly_flagged, alert_triggered, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (session_id) DO UPDATE SET
         child_id = EXCLUDED.child_id,
         composite_score = EXCLUDED.composite_score,
         anomaly_flagged = EXCLUDED.anomaly_flagged,
         alert_triggered = EXCLUDED.alert_triggered,
         created_at = EXCLUDED.created_at`,
      [
        session.session_id,
        session.child_id || null,
        session.composite_score || null,
        session.anomaly_flagged ? 1 : 0,
        session.alert_triggered ? 1 : 0,
        session.created_at || new Date().toISOString(),
      ],
    );
    count++;
  }
  return count;
}

export async function upsertAlert({ alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at }) {
  const pool = getPool();
  if (!alert_id || !child_id || !camp_id) {
    return { success: false, alert_id: null, error: 'Missing required fields' };
  }

  await pool.query(
    `INSERT INTO alerts (alert_id, child_id, res_id, camp_id, alert_type, trigger_detail, triggered_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     ON CONFLICT (alert_id) DO UPDATE SET
       child_id = EXCLUDED.child_id,
       res_id = EXCLUDED.res_id,
       camp_id = EXCLUDED.camp_id,
       alert_type = EXCLUDED.alert_type,
       trigger_detail = EXCLUDED.trigger_detail,
       triggered_at = EXCLUDED.triggered_at,
       status = 'pending'`,
    [alert_id, child_id, res_id || null, camp_id, alert_type || 'unknown', JSON.stringify(trigger_detail || {}), triggered_at || new Date().toISOString()],
  );

  return { success: true, alert_id };
}

export async function syncCamps(campList) {
  const pool = getPool();
  let count = 0;
  for (const camp of campList) {
    if (!camp.id) continue;
    await pool.query(
      `INSERT INTO "CAMPS" (id, code, name, lat, lng, status, displaced, capacity, aid, type, workers,
        water_path, river, station, st_dist, up_dist, wl, rain, alert_l, minor_l, major_l,
        gau_lat, gau_lng, fc_lat, fc_lng, elev, min_t, max_t, hum, precip, max_hr_prec,
        max_wind, avg_wind, soil, pres, cloud)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
       ON CONFLICT (id) DO UPDATE SET
         code = EXCLUDED.code, name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
         status = EXCLUDED.status, displaced = EXCLUDED.displaced, capacity = EXCLUDED.capacity,
         aid = EXCLUDED.aid, type = EXCLUDED.type, workers = EXCLUDED.workers,
         water_path = EXCLUDED.water_path, river = EXCLUDED.river, station = EXCLUDED.station,
         st_dist = EXCLUDED.st_dist, up_dist = EXCLUDED.up_dist, wl = EXCLUDED.wl,
         rain = EXCLUDED.rain, alert_l = EXCLUDED.alert_l, minor_l = EXCLUDED.minor_l,
         major_l = EXCLUDED.major_l, gau_lat = EXCLUDED.gau_lat, gau_lng = EXCLUDED.gau_lng,
         fc_lat = EXCLUDED.fc_lat, fc_lng = EXCLUDED.fc_lng, elev = EXCLUDED.elev,
         min_t = EXCLUDED.min_t, max_t = EXCLUDED.max_t, hum = EXCLUDED.hum,
         precip = EXCLUDED.precip, max_hr_prec = EXCLUDED.max_hr_prec,
         max_wind = EXCLUDED.max_wind, avg_wind = EXCLUDED.avg_wind,
         soil = EXCLUDED.soil, pres = EXCLUDED.pres, cloud = EXCLUDED.cloud`,
      [
        camp.id, camp.code, camp.name, camp.lat, camp.lng, camp.status, camp.displaced,
        camp.capacity, camp.aid, camp.type, camp.workers,
        camp.detail?.waterPath || null, camp.detail?.river || null, camp.detail?.station || null,
        camp.detail?.stDist || null, camp.detail?.upDist || null, camp.detail?.wl || null,
        camp.detail?.rain || null, camp.detail?.alertL || null, camp.detail?.minorL || null,
        camp.detail?.majorL || null, camp.detail?.gauLat || null, camp.detail?.gauLng || null,
        camp.detail?.fcLat || null, camp.detail?.fcLng || null, camp.detail?.elev || null,
        camp.detail?.minT || null, camp.detail?.maxT || null, camp.detail?.hum || null,
        camp.detail?.precip || null, camp.detail?.maxHrPrec || null, camp.detail?.maxWind || null,
        camp.detail?.avgWind || null, camp.detail?.soil || null, camp.detail?.pres || null,
        camp.detail?.cloud || null,
      ],
    );
    count++;
  }
  return count;
}
