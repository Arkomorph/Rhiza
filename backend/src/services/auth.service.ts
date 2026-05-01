import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import sql from '../db/postgres.js';
import { config } from '../config.js';
import type { Role } from '../types/roles.js';

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  password_hash: string;
}

export async function verifyCredentials(username: string, password: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    SELECT id, username, display_name, role, password_hash
    FROM config.users
    WHERE username = ${username} AND is_active = true
  `;
  if (rows.length === 0) return null;

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  return valid ? user : null;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  userId: string,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<string> {
  const refreshToken = crypto.randomUUID();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + config.JWT_REFRESH_TTL * 1000);

  await sql`
    INSERT INTO config.sessions (user_id, token_hash, user_agent, ip_address, expires_at)
    VALUES (${userId}, ${tokenHash}, ${userAgent ?? null}, ${ip ?? null}, ${expiresAt})
  `;

  return refreshToken;
}

export async function refreshSession(
  oldRefreshToken: string,
  ip: string | undefined,
  userAgent: string | undefined,
): Promise<{ userId: string; username: string; role: Role; newRefreshToken: string } | null> {
  const tokenHash = hashToken(oldRefreshToken);

  // Chercher et révoquer l'ancienne session en une requête
  const rows = await sql<{ user_id: string }[]>`
    UPDATE config.sessions
    SET revoked_at = now()
    WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > now()
    RETURNING user_id
  `;
  if (rows.length === 0) return null;

  const userId = rows[0].user_id;

  // Récupérer l'utilisateur
  const users = await sql<{ id: string; username: string; role: Role }[]>`
    SELECT id, username, role FROM config.users WHERE id = ${userId} AND is_active = true
  `;
  if (users.length === 0) return null;

  const user = users[0];
  const newRefreshToken = await createSession(userId, ip, userAgent);

  return { userId: user.id, username: user.username, role: user.role, newRefreshToken };
}

export async function revokeSession(refreshToken: string): Promise<boolean> {
  const tokenHash = hashToken(refreshToken);
  const rows = await sql`
    UPDATE config.sessions
    SET revoked_at = now()
    WHERE token_hash = ${tokenHash} AND revoked_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}
