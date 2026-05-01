import type { FastifyInstance } from 'fastify';
import { loginBodySchema } from '../schemas/auth.schemas.js';
import { verifyCredentials, createSession, refreshSession, revokeSession } from '../services/auth.service.js';
import { audit } from '../services/audit.service.js';
import { config } from '../config.js';

const COOKIE_NAME = 'rhiza_refresh';

const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/auth',
  maxAge: config.JWT_REFRESH_TTL,
};

export default async function authRoutes(fastify: FastifyInstance) {
  const log = fastify.log.child({ module: 'auth' });

  // ── POST /auth/login ──────────────────────────────────────
  fastify.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Identifiant et mot de passe requis' });
    }

    const { username, password } = parsed.data;
    const user = await verifyCredentials(username, password);

    if (!user) {
      log.warn({ reqId: request.id, username }, 'login failed');
      await audit({
        action: 'auth.login_failed',
        detail: { username },
        ipAddress: request.ip,
        requestId: request.id as string,
      });
      return reply.status(401).send({ error: 'Identifiants invalides' });
    }

    const accessToken = fastify.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    const refreshToken = await createSession(user.id, request.ip, request.headers['user-agent']);

    log.info({ reqId: request.id, userId: user.id, username: user.username }, 'login successful');
    await audit({
      userId: user.id,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      ipAddress: request.ip,
      requestId: request.id as string,
    });

    reply.setCookie(COOKIE_NAME, refreshToken, cookieOptions);
    return { accessToken, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } };
  });

  // ── POST /auth/refresh ────────────────────────────────────
  fastify.post('/refresh', async (request, reply) => {
    const oldToken = request.cookies[COOKIE_NAME];
    if (!oldToken) {
      return reply.status(401).send({ error: 'Refresh token manquant' });
    }

    const result = await refreshSession(oldToken, request.ip, request.headers['user-agent']);
    if (!result) {
      reply.clearCookie(COOKIE_NAME, { path: '/auth' });
      return reply.status(401).send({ error: 'Session expirée ou révoquée' });
    }

    const accessToken = fastify.jwt.sign({
      sub: result.userId,
      username: result.username,
      role: result.role,
    });

    log.info({ reqId: request.id, userId: result.userId }, 'token refreshed');
    await audit({
      userId: result.userId,
      action: 'auth.token_refresh',
      targetType: 'user',
      targetId: result.userId,
      ipAddress: request.ip,
      requestId: request.id as string,
    });

    reply.setCookie(COOKIE_NAME, result.newRefreshToken, cookieOptions);
    return { accessToken };
  });

  // ── POST /auth/logout ─────────────────────────────────────
  fastify.post('/logout', async (request, reply) => {
    const token = request.cookies[COOKIE_NAME];
    if (token) {
      await revokeSession(token);

      // Tenter de lire le user depuis le JWT (best-effort)
      let userId: string | undefined;
      try {
        await request.jwtVerify();
        userId = request.user.sub;
      } catch { /* token expiré ou absent — pas grave */ }

      log.info({ reqId: request.id, userId }, 'logout');
      await audit({
        userId,
        action: 'auth.logout',
        ipAddress: request.ip,
        requestId: request.id as string,
      });
    }

    reply.clearCookie(COOKIE_NAME, { path: '/auth' });
    return { ok: true };
  });
}
