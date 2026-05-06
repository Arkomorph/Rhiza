// ─── Routes Logs — Jalon 6.5 ─────────────────────────────────────────
// GET /logs : endpoint public avec auth Bearer pour Claude-Alpha et le
// frontend. Retourne les logs Pino du ring buffer + les logs front pushés.
// POST/GET/DELETE /logs/front : routes existantes pour le sync frontend.

import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

interface FrontLogEntry {
  id?: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  data?: unknown;
}

const MAX_FRONT_ENTRIES = 2000;
let frontBuffer: FrontLogEntry[] = [];

export default async function logsRoutes(fastify: FastifyInstance) {

  // ══════════════════════════════════════════════════════════════════
  // GET /logs — endpoint unifié avec auth Bearer
  // Rate limit : 60 req/min (override du global 120)
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/', {
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // Auth : header Bearer prioritaire, fallback ?token= en query
    const auth = request.headers.authorization;
    const query = request.query as {
      limit?: string; since?: string; level?: string; module?: string; token?: string;
    };
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : query.token;
    if (!token || token !== config.LOGS_TOKEN) {
      reply.code(401);
      return { error: 'Invalid or missing Bearer token' };
    }

    const limit = Math.min(parseInt(query.limit ?? '100', 10) || 100, 1000);

    // Logs backend depuis le ring buffer Pino
    const backendLogs = fastify.logBuffer.query({
      limit,
      since: query.since,
      level: query.level,
      module: query.module,
    }).map(e => ({
      timestamp: e.timestamp,
      level: e.level,
      origin: 'B' as const,
      module: e.module ?? null,
      message: e.msg,
      data: e.data ?? null,
    }));

    // Logs frontend depuis le buffer front
    let frontLogs = [...frontBuffer];
    if (query.since) {
      const sinceMs = new Date(query.since).getTime();
      frontLogs = frontLogs.filter(e => new Date(e.timestamp).getTime() > sinceMs);
    }
    if (query.level) {
      frontLogs = frontLogs.filter(e => e.level === query.level);
    }

    const frontMapped = frontLogs.slice(-limit).map(e => ({
      timestamp: e.timestamp,
      level: e.level,
      origin: 'F' as const,
      module: e.source ?? null,
      message: e.message,
      data: e.data ?? null,
    }));

    // Merge chronologique
    const merged = [...backendLogs, ...frontMapped]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);

    return { count: merged.length, entries: merged };
  });

  // ══════════════════════════════════════════════════════════════════
  // POST /logs/front — recevoir des logs du frontend
  // ══════════════════════════════════════════════════════════════════

  fastify.post('/front', async (request) => {
    const body = request.body as { entries?: FrontLogEntry[] };
    const incoming = body?.entries || [];

    for (const entry of incoming) {
      frontBuffer.push({
        id: frontBuffer.length + 1,
        timestamp: entry.timestamp || new Date().toISOString(),
        level: entry.level || 'info',
        source: entry.source || 'unknown',
        message: entry.message || '',
        data: entry.data,
      });
    }

    if (frontBuffer.length > MAX_FRONT_ENTRIES) {
      frontBuffer = frontBuffer.slice(-MAX_FRONT_ENTRIES);
    }

    return { ok: true, count: frontBuffer.length };
  });

  // ══════════════════════════════════════════════════════════════════
  // GET /logs/front — lire les logs front (rétrocompat)
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/front', async (request) => {
    const query = request.query as { level?: string; source?: string; limit?: string };

    let result = [...frontBuffer];

    if (query.level) {
      result = result.filter(e => e.level === query.level);
    }
    if (query.source) {
      result = result.filter(e => e.source.includes(query.source!));
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 200;
    if (limit > 0) {
      result = result.slice(-limit);
    }

    return { count: result.length, entries: result };
  });

  // ══════════════════════════════════════════════════════════════════
  // DELETE /logs/front — vider le buffer front
  // ══════════════════════════════════════════════════════════════════

  fastify.delete('/front', async () => {
    const count = frontBuffer.length;
    frontBuffer = [];
    return { ok: true, cleared: count };
  });
}
