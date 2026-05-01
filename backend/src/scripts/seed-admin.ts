// Crée le compte Super-Admin de Jo (idempotent)
// Usage : ADMIN_PASSWORD=xxx npx tsx src/scripts/seed-admin.ts

import bcrypt from 'bcrypt';
import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

const ADMIN_USERNAME = 'jo';
const ADMIN_DISPLAY_NAME = 'Jo';
const ADMIN_ROLE = 'super_admin';

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('❌ Variable ADMIN_PASSWORD requise');
  console.error('Usage : ADMIN_PASSWORD=monmotdepasse npx tsx src/scripts/seed-admin.ts');
  process.exit(1);
}

// S'assurer que les tables existent
await migrate();

const hash = await bcrypt.hash(password, 12);

const rows = await sql`
  INSERT INTO config.users (username, display_name, password_hash, role)
  VALUES (${ADMIN_USERNAME}, ${ADMIN_DISPLAY_NAME}, ${hash}, ${ADMIN_ROLE})
  ON CONFLICT (username)
  DO UPDATE SET password_hash = ${hash}, updated_at = now()
  RETURNING id, username, role
`;

console.log(`✔ Compte ${rows[0].role} créé/mis à jour : ${rows[0].username} (${rows[0].id})`);
await sql.end();
