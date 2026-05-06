// ─── Log Buffer Plugin — Jalon 6.5 ──────────────────────────────────
// Ring buffer en mémoire alimenté par les logs Pino.
// Utilise un hook onSend-like : on écoute les logs via pino child logger
// et on les stocke dans un buffer circulaire.
//
// Approche : on ajoute un hook onRequest + onResponse + onError qui
// capturent les logs structurés dans le buffer. Les routes peuvent aussi
// écrire directement dans le buffer via fastify.logBuffer.push().

import { FastifyPluginAsync } from 'fastify';
import { config } from '../config.js';

export interface BufferedLog {
  timestamp: string;
  level: string;
  module?: string;
  msg: string;
  data?: Record<string, unknown>;
}

const LEVEL_MAP: Record<number, string> = {
  10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal',
};

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

const logBufferPlugin: FastifyPluginAsync = async (fastify) => {
  const ringBuffer = new LogRingBuffer(config.LOGS_BUFFER_SIZE);

  // Décorer l'instance Fastify
  fastify.decorate('logBuffer', ringBuffer);

  // Intercepter les logs Pino en patchant le stream sous-jacent.
  // En production Pino écrit du JSON dans stdout — on parse chaque ligne
  // pour alimenter le ring buffer en parallèle.
  const rawStream = (fastify.log as unknown as { stream?: { write?: (chunk: string) => void } }).stream;
  if (rawStream && typeof rawStream.write === 'function') {
    const originalStreamWrite = rawStream.write.bind(rawStream);
    rawStream.write = (chunk: string) => {
      // Parser le log JSON Pino
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
        // Log non-JSON (pino-pretty en dev) — on parse ce qu'on peut
        ringBuffer.push({
          timestamp: new Date().toISOString(),
          level: 'info',
          msg: typeof chunk === 'string' ? chunk.trim() : String(chunk),
        });
      }
      return originalStreamWrite(chunk);
    };
  }
};

function extractData(parsed: Record<string, unknown>): Record<string, unknown> | undefined {
  // Extraire les champs métier (exclure les champs Pino standard)
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

export default logBufferPlugin;
