import crypto from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import requestLogger from './plugins/request-logger.js';
import jwtPlugin from './plugins/jwt.js';
import driver from './db/neo4j.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import territoiresRoutes from './routes/territoires.js';

const fastify = Fastify({
  logger: {
    level: config.LOG_LEVEL,
    transport: config.NODE_ENV === 'production'
      ? undefined
      : { target: 'pino-pretty' },
  },
  genReqId: () => crypto.randomUUID(),
  disableRequestLogging: true,
});

// Plugins
await fastify.register(cors, { origin: config.FRONTEND_ORIGIN });
await fastify.register(requestLogger);
await fastify.register(jwtPlugin);

// Routes
await fastify.register(healthRoutes);
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(territoiresRoutes, { prefix: '/territoires' });

// Connexions aux bases au démarrage
try {
  await migrate();
  fastify.log.info({ module: 'db' }, 'postgres connected, migration applied');
} catch (err) {
  fastify.log.fatal({ module: 'db', err }, 'postgres connection/migration failed');
  process.exit(1);
}

try {
  await driver.verifyConnectivity();
  fastify.log.info({ module: 'db' }, 'neo4j connected');
} catch (err) {
  fastify.log.fatal({ module: 'db', err }, 'neo4j connection failed');
  process.exit(1);
}

// Démarrage
try {
  await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
  fastify.log.info({ module: 'server' }, `rhiza-api listening on port ${config.PORT}`);
} catch (err) {
  fastify.log.fatal({ module: 'server', err }, 'startup failed');
  process.exit(1);
}
