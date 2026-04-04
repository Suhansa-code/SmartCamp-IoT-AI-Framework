// Add Turso Start and connectivity config here

const { createClient } = require('@libsql/client');
const C = require('./constants');

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
}

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
}

module.exports = {
  tursoClient,
  pgIsReachable,
  pgQuery,
    testConnection,
}

