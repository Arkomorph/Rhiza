import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from './postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<void> {
  const sqlDir = resolve(__dirname, '../../sql');
  const files = ['001-auth.sql', '002-metier.sql'];
  for (const file of files) {
    const ddl = readFileSync(resolve(sqlDir, file), 'utf-8');
    await sql.unsafe(ddl);
  }
}
