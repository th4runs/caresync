import pg from 'pg';
import 'dotenv/config';

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const mapRow = (row) => {
  const out = {};
  for (const k in row) out[camel(k)] = row[k];
  return out;
};

/** Run a query and return rows with camelCase keys. */
export async function q(sql, params = [], client = pool) {
  const res = await client.query(sql, params);
  return res.rows.map(mapRow);
}

/** Run a query and return the first row (or null). */
export async function one(sql, params = [], client = pool) {
  const rows = await q(sql, params, client);
  return rows[0] || null;
}

/** Run fn inside a transaction. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
