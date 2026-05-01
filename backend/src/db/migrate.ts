import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from './postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const sqlFile = resolve(__dirname, '../../sql/001-auth.sql');
  const ddl = readFileSync(sqlFile, 'utf-8');
  await sql.unsafe(ddl);
}
