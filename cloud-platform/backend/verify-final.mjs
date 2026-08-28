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
  'sensor_readings', 'disaster_events', 'environmental_data',
  'pages_behavioral_signals', 'pages_gate_decisions', 'pages_content_responses',
  'prediction_requests'
];

console.log('Table                          Rows');
console.log('─'.repeat(45));

let total = 0;
for (const t of tables) {
  try {
    const r = await pool.query(`SELECT COUNT(*) as cnt FROM ${t}`);
    const cnt = parseInt(r.rows[0].cnt);
    total += cnt;
    console.log(`${t.padEnd(30)} ${String(cnt).padStart(6)}`);
  } catch {
    console.log(`${t.padEnd(30)} (error)`);
  }
}

console.log('─'.repeat(45));
console.log(`${'TOTAL'.padEnd(30)} ${String(total).padStart(6)}`);

await pool.end();
