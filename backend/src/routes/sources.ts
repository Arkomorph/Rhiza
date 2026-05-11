// ─── Routes Sources — Jalon 8a Sprint 2 ─────────────────────────────
// Catalogue des sources de données. CRUD avec audit + validation Zod.
// Intégré depuis feature/sources-catalogue + POST/PATCH/DELETE ajoutés.

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sql from '../db/postgres.js';
import { runCypher } from '../db/neo4j.js';
import { auditSchema, auditMetier } from '../audit.js';
import { propertyColumns } from '../helpers.js';

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

// Audit : auditSchema importé depuis ../audit.ts
const audit = (action: 'INSERT' | 'UPDATE' | 'DELETE', resourceId: string, before: unknown, after: unknown) =>
  auditSchema(action, 'sources', resourceId, before, after);

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

    const rawBody = request.body as Record<string, unknown>;
    const draftConfig = rawBody.draft_config !== undefined ? rawBody.draft_config : undefined;
    const parsed = createSourceSchema.partial().omit({ id: true }).safeParse(rawBody);
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

    const draftValue = draftConfig !== undefined ? draftConfig : (before.draft_config ?? {});
    await sql`
      UPDATE config.sources
      SET nom = ${after.nom}, format = ${after.format}, portail = ${after.portail},
          theme = ${after.theme}, status = ${after.status}, target_type = ${after.target_type},
          endpoint_url = ${after.endpoint_url}, endpoint_protocol = ${after.endpoint_protocol},
          complet = ${after.complet}, draft_config = ${sql.json(draftValue)}, updated_at = now()
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

  // ══════════════════════════════════════════════════════════════════
  // POST /sources/:id/execute — moteur d'exécution GeoJSON (J8b)
  // ══════════════════════════════════════════════════════════════════

  fastify.post('/:id/execute', async (request, reply) => {
    const { id } = request.params as { id: string };
    const start = Date.now();

    // a) Vérifier la source
    const [source] = await sql`SELECT * FROM config.sources WHERE id = ${id} AND archived_at IS NULL`;
    if (!source) { reply.code(404); return { error: 'Source non trouvée' }; }
    if (!source.target_type) { reply.code(400); return { error: 'Configurez d\'abord le type cible (target_type) sur cette source' }; }
    if (source.format !== 'GeoJSON') { reply.code(400); return { error: `Format "${source.format}" non supporté Sprint 2 — seul GeoJSON est pris en charge` }; }

    // b) Parser le multipart
    let fileBuffer: Buffer | null = null;
    let mappingRaw: string | null = null;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        fileBuffer = await part.toBuffer();
      } else if (part.type === 'field' && part.fieldname === 'mapping') {
        mappingRaw = part.value as string;
      }
    }

    if (!fileBuffer) { reply.code(400); return { error: 'Fichier GeoJSON manquant (champ "file")' }; }
    if (!mappingRaw) { reply.code(400); return { error: 'Mapping manquant (champ "mapping")' }; }

    // c) Parser et valider le GeoJSON
    let geojson: { type: string; features: Array<{ type: string; properties: Record<string, unknown>; geometry: unknown }> };
    try {
      geojson = JSON.parse(fileBuffer.toString('utf-8'));
    } catch { reply.code(400); return { error: 'Fichier JSON invalide' }; }

    if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      reply.code(400);
      return { error: 'Le fichier doit être un GeoJSON FeatureCollection' };
    }

    // Parser le mapping
    let mapping: { nom_field: string; properties?: Array<{ source: string; target: string }> };
    try {
      mapping = JSON.parse(mappingRaw);
    } catch { reply.code(400); return { error: 'Mapping JSON invalide' }; }

    if (!mapping.nom_field) { reply.code(400); return { error: 'nom_field est obligatoire dans le mapping' }; }

    // d) INSERT initial dans source_executions
    const [exec] = await sql`
      INSERT INTO config.source_executions (source_id, executed_by, summary, success, duration_ms)
      VALUES (${id}, NULL, 'En cours', NULL, NULL)
      RETURNING id
    `;
    const executionId = exec.id as number;

    fastify.log.info({ module: 'execution', action: 'START', source_id: id, execution_id: executionId }, 'execution started');

    // f) Pour chaque feature
    const total = geojson.features.length;
    let created = 0;
    let failed = 0;
    const errors: Array<{ feature_index: number; reason: string }> = [];
    const targetType = source.target_type as string;
    const natureHistory = `Territoire:${targetType}:`;

    for (let i = 0; i < geojson.features.length; i++) {
      const feature = geojson.features[i];
      try {
        const props = feature.properties || {};
        const nom = props[mapping.nom_field];
        if (!nom) throw new Error(`Champ "${mapping.nom_field}" vide ou absent`);

        const geomJson = feature.geometry ? JSON.stringify(feature.geometry) : null;

        // Postgres : créer le territoire + nature_history + properties mappées
        const uuid = await sql.begin(async (tx) => {
          let inserted;
          if (geomJson) {
            [inserted] = await tx`
              INSERT INTO metier.territoires (nom, geom)
              VALUES (${String(nom)}, ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 2056))
              RETURNING uuid
            `;
          } else {
            [inserted] = await tx`
              INSERT INTO metier.territoires (nom)
              VALUES (${String(nom)})
              RETURNING uuid
            `;
          }
          const nodeUuid = inserted.uuid as string;

          // nature_history
          await tx`
            INSERT INTO metier.properties (node_uuid, property_name, value_text, source, confidence)
            VALUES (${nodeUuid}, 'nature_history', ${natureHistory}, 'pipeline', 'high')
          `;

          // Propriétés mappées
          if (mapping.properties) {
            for (const pm of mapping.properties) {
              const val = props[pm.source];
              if (val === undefined || val === null) continue;
              const cols = propertyColumns(val);
              await tx`
                INSERT INTO metier.properties (node_uuid, property_name, value_text, value_number, value_json, source, confidence)
                VALUES (${nodeUuid}, ${pm.target}, ${cols.value_text}, ${cols.value_number}, ${cols.value_json ? sql.json(cols.value_json) : null}, 'pipeline', 'medium')
              `;
            }
          }

          return nodeUuid;
        });

        // Neo4j : créer le nœud (pas d'arête — J7)
        await runCypher('CREATE (n:Territoire {uuid: $uuid})', { uuid });

        // Audit métier
        const after = { nom: String(nom), subtype: natureHistory, source_id: id };
        await auditMetier('INSERT', 'territoires', uuid, null, after, 'pipeline', executionId, id);

        created++;
      } catch (err: unknown) {
        failed++;
        const reason = err instanceof Error ? err.message : String(err);
        errors.push({ feature_index: i, reason });
      }
    }

    // g) UPDATE source_executions
    const summary = `${created} créées sur ${total}, ${failed} erreurs`;
    const durationMs = Date.now() - start;
    await sql`
      UPDATE config.source_executions
      SET summary = ${summary},
          changes = ${sql.json({ total_features: total, created, failed, errors })}::jsonb,
          duration_ms = ${durationMs},
          success = ${created > 0}
      WHERE id = ${executionId}
    `;

    fastify.log.info({
      module: 'execution', action: 'COMPLETE', source_id: id,
      execution_id: executionId, created, failed, duration_ms: durationMs,
    }, 'execution completed');

    // h) Retourner le résumé
    return {
      execution_id: executionId,
      source_id: id,
      summary,
      total_features: total,
      created,
      failed,
      errors,
      duration_ms: durationMs,
    };
  });
};

export default sourcesRoutes;
