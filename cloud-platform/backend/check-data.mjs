import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_BwI0CNUj3mnu@ep-withered-snow-ayn23ggm.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

await pool.query('SET search_path TO public');

const tables = [
  'devices', 'persons', 'camp_checkins', 'wristbands', 'distributions',
  'resources', 'audit_logs', 'children', 'sessions', 'alerts',
  'gps_readings', 'disaster_alerts', 'flood_predictions',
  'water_level_readings', 'weather_data', 'hydrospatial_data',
  'sensor_readings', 'disaster_events'
];

for (const t of tables) {
  try {
    const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${t}`);
    console.log(`${t.padEnd(25)} ${r.rows[0].cnt}`);
  } catch {
    console.log(`${t.padEnd(25)} (not found)`);
  }
}

await pool.end();
