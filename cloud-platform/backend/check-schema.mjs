import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_BwI0CNUj3mnu@ep-withered-snow-ayn23ggm.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

// Check current schema
const schemaCheck = await pool.query("SELECT current_schema()");
console.log('Current schema:', schemaCheck.rows[0].current_schema);

// Check available schemas
const schemas = await pool.query("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name");
console.log('Schemas:', schemas.rows.map(r => r.schema_name).join(', '));

// Check if we can create in public
try {
  await pool.query('CREATE SCHEMA IF NOT EXISTS public');
  console.log('Public schema: OK');
} catch (e) {
  console.log('Public schema error:', e.message);
}

// Try setting search_path
await pool.query('SET search_path TO public');

// Try creating a test table
try {
  await pool.query('CREATE TABLE IF NOT EXISTS _test_table (id INT)');
  await pool.query('DROP TABLE IF EXISTS _test_table');
  console.log('CREATE TABLE: OK');
} catch (e) {
  console.log('CREATE TABLE error:', e.message);
}

await pool.end();
