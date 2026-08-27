import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'src/db/schema.sql');
const raw = readFileSync(schemaPath, 'utf8');

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_BwI0CNUj3mnu@ep-withered-snow-ayn23ggm.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
});

// Ensure public schema exists and set search_path
await pool.query('CREATE SCHEMA IF NOT EXISTS public');
await pool.query('SET search_path TO public');

// Split schema into individual statements
const statements = raw
  .split(';')
  .map(s => s.replace(/--.*$/gm, '').trim())
  .filter(s => s.length > 0);

let success = 0;
let failed = 0;

for (const stmt of statements) {
  try {
    await pool.query(stmt);
    success++;
  } catch (err) {
    if (!err.message.includes('already exists')) {
      console.error(`FAILED: ${err.message.substring(0, 120)}`);
      console.error(`  Stmt: ${stmt.substring(0, 80)}...`);
      failed++;
    } else {
      success++;
    }
  }
}

console.log(`Schema applied: ${success} succeeded, ${failed} failed`);

// Verify tables
const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
console.log('Tables:', result.rows.map(r => r.table_name).join(', '));

await pool.end();
