// Add Turso Start and connectivity config here

import { createClient } from '@libsql/client';
import C from './constants.js';

const tursoClient = createClient({
  url: C.TURSO_URL,
  authToken: C.TURSO_AUTH_TOKEN
});

const testConnection = async () => {
  try {
    await tursoClient.execute('SELECT 1');
    console.log('[TURSO] Connection test successful');
  } catch (err) {
    console.error(`[TURSO] Connection test failed: ${err.message}`);
    throw err;
  }
};

const pgQuery = async (text, params) => {
  const { sql, args } = toLibsqlQuery(text, params);
  try {
    const result = await tursoClient.execute(sql, args);
    return result.rows;
  } catch (err) {
    console.error(`[TURSO] Query failed: ${err.message}`);
    throw err;
  }
};

const pgIsReachable = async () => {
  try {
    await tursoClient.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

const checkResId = async (resId) => {
  try {
    const result = await tursoClient.execute('SELECT 1 WHERE ? LIKE ?', [resId, '%']);
    return result.rows.length > 0;
  } catch (err) {
    console.error(`[TURSO] checkResId failed: ${err.message}`);
    return false;
  }
};

export {
  tursoClient,
  pgIsReachable,
  pgQuery,
  testConnection,
  checkResId,
};

