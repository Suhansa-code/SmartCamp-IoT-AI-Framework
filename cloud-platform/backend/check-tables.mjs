import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_BwI0CNUj3mnu@ep-withered-snow-ayn23ggm.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
});
const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
console.log('Tables:', result.rows.map(r => r.table_name).join(', '));
await pool.end();
