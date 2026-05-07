import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

// Masque ?token=xxx dans les URLs pour éviter de logger des secrets
function redactUrl(url: string): string {
  return url.replace(/([?&])token=[^&]*/g, '$1token=***');
}

async function requestLoggerPlugin(fastify: FastifyInstance) {
  const log = fastify.log.child({ module: 'http' });

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.startTime = process.hrtime.bigint();
    log.info({
      reqId: request.id,
      method: request.method,
      url: redactUrl(request.url),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    }, 'incoming request');
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const durationNs = process.hrtime.bigint() - request.startTime;
    const durationMs = Number(durationNs) / 1_000_000;

    log.info({
      reqId: request.id,
      method: request.method,
      url: redactUrl(request.url),
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ...(request.routeNotFound ? { routeNotFound: true } : {}),
    }, 'request completed');
  });

  // Routes non enregistrées → marquer pour filtrage ring buffer
  fastify.setNotFoundHandler(async (request, reply) => {
    request.routeNotFound = true;
    reply.code(404).send({ error: 'Not Found' });
  });

  fastify.setErrorHandler(async (error: { statusCode?: number; message: string; code?: string }, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const level = statusCode >= 500 ? 'error' : 'warn';

    log[level]({
      reqId: request.id,
      method: request.method,
      url: redactUrl(request.url),
      statusCode,
      err: { message: error.message, code: error.code },
    }, statusCode >= 500 ? 'server error' : 'client error');

    reply.status(statusCode).send({
      error: statusCode >= 500 ? 'Internal Server Error' : error.message,
    });
  });
}

export default fp(requestLoggerPlugin, { name: 'request-logger' });

// Augmentation pour startTime
declare module 'fastify' {
  interface FastifyRequest {
    startTime: bigint;
    routeNotFound?: boolean;
  }
}
