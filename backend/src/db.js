import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

export async function query(text, params) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  return pool.query(text, params);
}
