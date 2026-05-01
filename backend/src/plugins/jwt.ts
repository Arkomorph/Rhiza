import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import { config } from '../config.js';
import type { Role } from '../types/roles.js';
import { hasMinRole } from '../types/roles.js';

async function jwtPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_TTL },
  });

  await fastify.register(fastifyCookie);

  // Décorateur authenticate — preValidation hook pour routes protégées
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Token invalide ou expiré' });
    }
  });

  // Factory pour garde de rôle minimum
  fastify.decorate('requireRole', (minRole: Role) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      await fastify.authenticate(request, reply);
      if (reply.sent) return;

      if (!hasMinRole(request.user.role, minRole)) {
        reply.status(403).send({ error: 'Permissions insuffisantes' });
      }
    };
  });
}

export default fp(jwtPlugin, { name: 'jwt' });

// Augmentation pour les décorateurs
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (minRole: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
