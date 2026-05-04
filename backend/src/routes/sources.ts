import { FastifyPluginAsync } from 'fastify';
import sql from '../db/postgres.js';

const sourcesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /sources — list all, with optional filtering
  fastify.get('/', async (request, reply) => {
    const { q, format, portail, access, status } = request.query as {
      q?: string;
      format?: string;
      portail?: string;
      access?: string;
      status?: string;
    };

    const conditions = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(sql`(nom ILIKE ${pattern} OR format ILIKE ${pattern} OR portail ILIKE ${pattern} OR theme ILIKE ${pattern})`);
    }
    if (format) conditions.push(sql`format = ${format}`);
    if (portail) conditions.push(sql`portail = ${portail}`);
    if (access) conditions.push(sql`access = ${access}`);
    if (status) conditions.push(sql`status = ${status}`);

    const where = conditions.length
      ? sql`WHERE ${conditions.reduce((acc, c) => sql`${acc} AND ${c}`)}`
      : sql``;

    const sources = await sql`SELECT * FROM config.sources ${where} ORDER BY id`;
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM config.sources ${where}`;

    return { sources, total: count };
  });

  // GET /sources/:id — single source with last 10 executions
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [source] = await sql`SELECT * FROM config.sources WHERE id = ${id}`;
    if (!source) {
      reply.code(404);
      return { error: 'Source not found' };
    }

    const executions = await sql`
      SELECT * FROM config.source_executions
      WHERE source_id = ${id}
      ORDER BY executed_at DESC
      LIMIT 10
    `;

    return { source, executions };
  });

  // GET /sources/:id/executions — paginated executions
  fastify.get('/:id/executions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = '20', offset = '0' } = request.query as { limit?: string; offset?: string };

    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const off = parseInt(offset, 10) || 0;

    const executions = await sql`
      SELECT * FROM config.source_executions
      WHERE source_id = ${id}
      ORDER BY executed_at DESC
      LIMIT ${lim} OFFSET ${off}
    `;

    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM config.source_executions
      WHERE source_id = ${id}
    `;

    return { executions, total: count };
  });
};

export default sourcesRoutes;
