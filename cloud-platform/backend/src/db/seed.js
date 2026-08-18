/**
 * Database seed — run `npm run db:seed` to load the education seed data
 * (children, sessions, alerts) into PostgreSQL. Uses the postgres repository
 * so it shares the exact same write path as the API.
 */
import { syncChildren, syncSessions, upsertAlert } from '../repositories/education/alert.postgres.repository.js';
import { EDUCATION_SEED } from '../data/education/education.data.js';
import { testConnection, closeDatabase } from '../config/database.js';

async function main() {
  try {
    const ok = await testConnection();
    if (!ok) {
      console.error('[db:seed] Connection test failed');
      process.exit(1);
    }

    const { children, sessions, alerts } = EDUCATION_SEED;

    const childrenCount = await syncChildren(children);
    console.log(`[db:seed] Synced ${childrenCount} children`);

    const sessionsCount = await syncSessions(sessions);
    console.log(`[db:seed] Synced ${sessionsCount} sessions`);

    for (const alert of alerts) {
      await upsertAlert(alert);
    }
    console.log(`[db:seed] Synced ${alerts.length} alerts`);

    await closeDatabase();
    console.log('[db:seed] Done');
    process.exit(0);
  } catch (err) {
    console.error('[db:seed] Failed:', err.message);
    await closeDatabase();
    process.exit(1);
  }
}

main();