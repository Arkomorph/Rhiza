// ─── Log Buffer Plugin — Jalon 6.5 ──────────────────────────────────
// Ring buffer en mémoire alimenté par les logs Pino.
// En production (JSON stdout), on intercepte les logs via un hook
// onResponse et en patchant le stream Pino sous-jacent.
// En dev (pino-pretty), seuls les logs applicatifs (via addHook) sont
// capturés — suffisant pour valider le flux.

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';

export interface BufferedLog {
  timestamp: string;
  level: string;
  module?: string;
  msg: string;
  data?: Record<string, unknown>;
}

class LogRingBuffer {
  private buffer: BufferedLog[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(entry: BufferedLog) {
    this.buffer.push(entry);
    if (this.buffer.length > this.maxSize) {
      this.buffer = this.buffer.slice(-this.maxSize);
    }
  }

  query(opts: { limit?: number; since?: string; level?: string; module?: string }): BufferedLog[] {
    let result = this.buffer;

    if (opts.since) {
      const sinceDate = new Date(opts.since).getTime();
      result = result.filter(e => new Date(e.timestamp).getTime() > sinceDate);
    }
    if (opts.level) {
      result = result.filter(e => e.level === opts.level);
    }
    if (opts.module) {
      result = result.filter(e => e.module === opts.module);
    }

    const limit = Math.min(opts.limit ?? 100, 1000);
    return result.slice(-limit);
  }

  get size() { return this.buffer.length; }
}

// Augmentation de type Fastify
declare module 'fastify' {
  interface FastifyInstance {
    logBuffer: LogRingBuffer;
  }
}

const LEVEL_MAP: Record<number, string> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal',
};

function extractData(parsed: Record<string, unknown>): Record<string, unknown> | undefined {
  const exclude = new Set(['level', 'time', 'pid', 'hostname', 'msg', 'module', 'reqId', 'req', 'res']);
  const data: Record<string, unknown> = {};
  let hasData = false;
  for (const [key, value] of Object.entries(parsed)) {
    if (!exclude.has(key)) {
      data[key] = value;
      hasData = true;
    }
  }
  return hasData ? data : undefined;
}

async function logBufferPlugin(fastify: FastifyInstance) {
  const ringBuffer = new LogRingBuffer(config.LOGS_BUFFER_SIZE);

  // Décorer l'instance Fastify — fp() fait remonter au scope parent
  fastify.decorate('logBuffer', ringBuffer);

  // Tenter le patch du stream Pino (fonctionne en production, JSON stdout)
  // En Pino 10, le stream est un symbol local (pas Symbol.for), on le cherche par description
  const logger = fastify.log as unknown as Record<symbol, unknown>;
  const pinoStreamSym = Object.getOwnPropertySymbols(logger).find(
    s => s.description === 'pino.stream',
  );
  const rawStream = pinoStreamSym
    ? (logger[pinoStreamSym] as { write?: (chunk: string) => boolean } | undefined)
    : undefined;

  if (rawStream && typeof rawStream.write === 'function') {
    const originalWrite = rawStream.write.bind(rawStream);
    rawStream.write = (chunk: string): boolean => {
      try {
        const parsed = JSON.parse(chunk);
        const level = LEVEL_MAP[parsed.level] ?? 'info';
        ringBuffer.push({
          timestamp: parsed.time ? new Date(parsed.time).toISOString() : new Date().toISOString(),
          level,
          module: parsed.module,
          msg: parsed.msg || '',
          data: extractData(parsed),
        });
      } catch {
        // Non-JSON ou parse error — on ignore silencieusement
      }
      return originalWrite(chunk);
    };
  } else {
    // Fallback : capturer les logs via les hooks de requête
    // Couvre les cas où le stream n'est pas directement patchable (dev/pino-pretty)
    fastify.addHook('onResponse', (request, reply, done) => {
      ringBuffer.push({
        timestamp: new Date().toISOString(),
        level: reply.statusCode >= 500 ? 'error' : reply.statusCode >= 400 ? 'warn' : 'info',
        module: 'http',
        msg: `${request.method} ${request.url} ${reply.statusCode}`,
        data: {
          reqId: request.id,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
        },
      });
      done();
    });
  }
}

export default fp(logBufferPlugin, { name: 'log-buffer' });
