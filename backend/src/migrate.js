import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

const client = await pool.connect();

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);

  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  for (const filename of files) {
    const existing = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (existing.rowCount) {
      console.log(`skip ${filename}`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`apply ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
