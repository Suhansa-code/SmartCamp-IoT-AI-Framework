/**
 * Database bootstrap — run `npm run db:init` to create the schema.
 * Uses the same env configuration as the server (backend/.env).
 */
import { initSchema, testConnection, closeDatabase } from '../config/database.js';

async function main() {
  try {
    const ok = await testConnection();
    if (!ok) {
      console.error('[db:init] Connection test failed');
      process.exit(1);
    }
    console.log('[db:init] Connection OK');

    await initSchema();
    console.log('[db:init] Schema created/verified');

    await closeDatabase();
    process.exit(0);
  } catch (err) {
    console.error('[db:init] Failed:', err.message);
    await closeDatabase();
    process.exit(1);
  }
}

main();
