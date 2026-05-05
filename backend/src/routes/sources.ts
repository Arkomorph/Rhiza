// ─── Routes Sources — Jalon 8a Sprint 2 ─────────────────────────────
// Catalogue des sources de données. CRUD avec audit + validation Zod.
// Intégré depuis feature/sources-catalogue + POST/PATCH/DELETE ajoutés.

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sql from '../db/postgres.js';

// ─── Validation Zod ──────────────────────────────────────────────────

const SOURCE_FORMATS = ['WFS', 'GeoJSON', 'CSV', 'Shapefile', 'GeoPackage', 'INTERLIS'] as const;
const SOURCE_STATUSES = ['brouillon', 'configuree', 'en_service', 'erreur'] as const;

const createSourceSchema = z.object({
  id: z.string().regex(/^S\d{3,}$/, 'Format ID : S suivi de 3+ chiffres (ex: S001, S111)'),
  nom: z.string().min(1),
  format: z.enum(SOURCE_FORMATS),
  portail: z.string().nullable().optional(),
  theme: z.string().nullable().optional(),
  indicators: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  grain: z.string().nullable().optional(),
  extent: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  access: z.string().nullable().optional(),
  status: z.enum(SOURCE_STATUSES).default('brouillon'),
  endpoint_url: z.string().nullable().optional(),
  endpoint_protocol: z.string().nullable().optional(),
  complet: z.boolean().default(false),
  target_type: z.string().nullable().optional(),
});

// ─── Audit helper ────────────────────────────────────────────────────

async function audit(
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  resourceId: string,
  before: unknown,
  after: unknown,
) {
  const beforeJson = before ? JSON.stringify(before) : null;
  const afterJson = after ? JSON.stringify(after) : null;
  await sql`
    INSERT INTO config.schema_audit (action, resource_type, resource_id, before, after, source)
    VALUES (${action}, 'sources', ${resourceId}, ${beforeJson}::jsonb, ${afterJson}::jsonb, 'api')
  `;
}

// ─── Plugin ──────────────────────────────────────────────────────────

const sourcesRoutes: FastifyPluginAsync = async (fastify) => {

  // ══════════════════════════════════════════════════════════════════
  // GET /sources — liste filtrable
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/', async (request) => {
    const { q, format, portail, access, status, target_type, include_archived } = request.query as {
      q?: string; format?: string; portail?: string; access?: string;
      status?: string; target_type?: string; include_archived?: string;
    };

    const conditions = [];
    if (!include_archived) conditions.push(sql`archived_at IS NULL`);
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(sql`(nom ILIKE ${pattern} OR format ILIKE ${pattern} OR portail ILIKE ${pattern} OR theme ILIKE ${pattern})`);
    }
    if (format) conditions.push(sql`format = ${format}`);
    if (portail) conditions.push(sql`portail = ${portail}`);
    if (access) conditions.push(sql`access = ${access}`);
    if (status) conditions.push(sql`status = ${status}`);
    if (target_type) conditions.push(sql`target_type = ${target_type}`);

    const where = conditions.length
      ? sql`WHERE ${conditions.reduce((acc, c) => sql`${acc} AND ${c}`)}`
      : sql``;

    const sources = await sql`SELECT * FROM config.sources ${where} ORDER BY id`;
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM config.sources ${where}`;

    return { sources, total: count };
  });

  // ══════════════════════════════════════════════════════════════════
  // GET /sources/:id — détail + dernières exécutions
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const [source] = await sql`SELECT * FROM config.sources WHERE id = ${id}`;
    if (!source) { reply.code(404); return { error: 'Source not found' }; }

    const executions = await sql`
      SELECT * FROM config.source_executions
      WHERE source_id = ${id} ORDER BY executed_at DESC LIMIT 10
    `;
    return { source, executions };
  });

  // ══════════════════════════════════════════════════════════════════
  // GET /sources/:id/executions — historique paginé
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/:id/executions', async (request) => {
    const { id } = request.params as { id: string };
    const { limit = '20', offset = '0' } = request.query as { limit?: string; offset?: string };
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const off = parseInt(offset, 10) || 0;

    const executions = await sql`
      SELECT * FROM config.source_executions
      WHERE source_id = ${id} ORDER BY executed_at DESC LIMIT ${lim} OFFSET ${off}
    `;
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM config.source_executions WHERE source_id = ${id}
    `;
    return { executions, total: count };
  });

  // ══════════════════════════════════════════════════════════════════
  // POST /sources — création
  // ══════════════════════════════════════════════════════════════════

  fastify.post('/', async (request, reply) => {
    const start = Date.now();
    const parsed = createSourceSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    // Vérifier unicité de l'ID
    const [existing] = await sql`SELECT id FROM config.sources WHERE id = ${data.id}`;
    if (existing) { reply.code(409); return { error: `Source ${data.id} existe déjà` }; }

    // Vérifier target_type FK si fourni
    if (data.target_type) {
      const [typeExists] = await sql`SELECT key FROM config.schema_types WHERE key = ${data.target_type} AND archived_at IS NULL`;
      if (!typeExists) { reply.code(400); return { error: `Type cible "${data.target_type}" n'existe pas dans le schéma` }; }
    }

    try {
      await sql`
        INSERT INTO config.sources (id, nom, format, portail, theme, indicators, producer, year, grain, extent, url, access, status, endpoint_url, endpoint_protocol, complet, target_type)
        VALUES (${data.id}, ${data.nom}, ${data.format}, ${data.portail ?? null}, ${data.theme ?? null},
                ${data.indicators ?? null}, ${data.producer ?? null}, ${data.year ?? null},
                ${data.grain ?? null}, ${data.extent ?? null}, ${data.url ?? null}, ${data.access ?? null},
                ${data.status}, ${data.endpoint_url ?? null}, ${data.endpoint_protocol ?? null},
                ${data.complet}, ${data.target_type ?? null})
      `;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('duplicate key') || msg.includes('23505')) {
        reply.code(409);
        return { error: `Source ${data.id} existe déjà` };
      }
      throw err;
    }

    await audit('INSERT', data.id, null, data);
    fastify.log.info({ module: 'sources', action: 'INSERT', resource_id: data.id, duration_ms: Date.now() - start }, 'source created');

    reply.code(201);
    return data;
  });

  // ══════════════════════════════════════════════════════════════════
  // PATCH /sources/:id — modification ciblée
  // ══════════════════════════════════════════════════════════════════

  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.sources WHERE id = ${id} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Source non trouvée' }; }

    const parsed = createSourceSchema.partial().omit({ id: true }).safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    if (data.target_type) {
      const [typeExists] = await sql`SELECT key FROM config.schema_types WHERE key = ${data.target_type} AND archived_at IS NULL`;
      if (!typeExists) { reply.code(400); return { error: `Type cible "${data.target_type}" n'existe pas dans le schéma` }; }
    }

    const after = {
      nom: data.nom ?? before.nom,
      format: data.format ?? before.format,
      portail: data.portail !== undefined ? data.portail : before.portail,
      theme: data.theme !== undefined ? data.theme : before.theme,
      status: data.status ?? before.status,
      target_type: data.target_type !== undefined ? data.target_type : before.target_type,
      endpoint_url: data.endpoint_url !== undefined ? data.endpoint_url : before.endpoint_url,
      endpoint_protocol: data.endpoint_protocol !== undefined ? data.endpoint_protocol : before.endpoint_protocol,
      complet: data.complet ?? before.complet,
    };

    await sql`
      UPDATE config.sources
      SET nom = ${after.nom}, format = ${after.format}, portail = ${after.portail},
          theme = ${after.theme}, status = ${after.status}, target_type = ${after.target_type},
          endpoint_url = ${after.endpoint_url}, endpoint_protocol = ${after.endpoint_protocol},
          complet = ${after.complet}, updated_at = now()
      WHERE id = ${id}
    `;

    await audit('UPDATE', id, before, after);
    fastify.log.info({ module: 'sources', action: 'UPDATE', resource_id: id, duration_ms: Date.now() - start }, 'source updated');

    return { id, ...after };
  });

  // ══════════════════════════════════════════════════════════════════
  // DELETE /sources/:id — archivage logique
  // ══════════════════════════════════════════════════════════════════

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.sources WHERE id = ${id} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Source non trouvée' }; }

    await sql`UPDATE config.sources SET archived_at = now() WHERE id = ${id}`;

    await audit('DELETE', id, before, null);
    fastify.log.info({ module: 'sources', action: 'DELETE', resource_id: id, duration_ms: Date.now() - start }, 'source archived');

    return { ok: true };
  });
};

export default sourcesRoutes;
