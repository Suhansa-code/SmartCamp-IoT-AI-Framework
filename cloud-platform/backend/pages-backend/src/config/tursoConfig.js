// Add Turso Start and connectivity config here

import { createClient } from '@libsql/client';
import C from './constants.js';
import logger from '../utils/logger.js';
import { response } from 'express';

const toLibsqlQuery = (text, params) => {
  let sql = text;
  const args = [];
  for (const key in params) {
    const placeholder = new RegExp(`:${key}\\b`, 'g');
    sql = sql.replace(placeholder, '?');
    args.push(params[key]);
  }
  return { sql, args };
}

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

async function tursoInsert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

  logger.info(`[TURSO] Inserting into ${table}: ${JSON.stringify(data)}`);
  
  try {
    const result = await pgQuery(sql, values);
    logger.info(`[TURSO] Inserted into ${table}: ${JSON.stringify(data)}`);
    response.success = true;
    return result;
  } catch (err) {
    logger.error(`[TURSO] Insert into ${table} failed: ${err.message}`);
    response.success = false;
    throw err;
  }

}

async function tursoUpdate(table, data, whereClause, whereParams) {
  const setClause = Object.keys(data).map(col => `${col} = ?`).join(', ');
  const values = Object.values(data);
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  try {
    const result = await pgQuery(sql, [...values, ...whereParams]);
    logger.info(`[TURSO] Updated ${table}: ${JSON.stringify(data)} where ${whereClause}`);
    return result;
  } catch (err) {
    logger.error(`[TURSO] Update ${table} failed: ${err.message}`);
    throw err;
  }
}

async function tursoRetrieve(table, columns, whereClause, whereParams) {
  const columnSql =
    columns === undefined || columns === null || columns === ''
      ? '*'
      : Array.isArray(columns)
        ? (columns.length ? columns.join(', ') : '*')
        : (typeof columns === 'string' && columns.trim().length ? columns : '*');
  const sql = `SELECT ${columnSql} FROM ${table} WHERE ${whereClause}`;
  
  try {
    const result = await pgQuery(sql, whereParams);
    logger.info(`[TURSO] Retrieved from ${table}: columns=${columnSql} where ${whereClause}`);
    return result;
  } catch (err) {
    logger.error(`[TURSO] Retrieve from ${table} failed: ${err.message}`);
    throw err;
  }
}

async function tursoGetLastChildId() {
  const result = await pgQuery(`
    SELECT child_id FROM pages_children ORDER BY child_id DESC LIMIT 1
  `);
  return result.length > 0 ? result[0].child_id : null;
}

export {
  tursoClient,
  pgIsReachable,
  pgQuery,
  testConnection,
  checkResId,
  tursoInsert,
  tursoUpdate,
  tursoRetrieve,
  tursoGetLastChildId
};

