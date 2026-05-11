// ─── Routes Schema — Jalon 6 Sprint 2 ────────────────────────────────
// GET /schema — retourne tout le schéma (plat par table)
// POST/PATCH/DELETE par ressource ciblée avec audit + validation Zod
// Décisions K-Q implémentées

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sql from '../db/postgres.js';
import { auditSchema as audit } from '../audit.js';

// ─── Validation Zod (Décision P) ─────────────────────────────────────
// Enum fermées pour data_type et geom_kind — plus de TEXT libre.

const DATA_TYPES = ['string', 'integer', 'float', 'boolean', 'date', 'enum', 'geometry', 'text', 'list'] as const;
const GEOM_KINDS = ['point', 'linestring', 'polygon'] as const;
const OBLIGATIONS = ['hard', 'soft'] as const;
const MULTIPLICITIES = ['one', 'many'] as const;
const DEFAULT_MODES = ['linkOrCreateField', 'linkOrCreateGeneric', 'disabled'] as const;
const DIRECTIONS = ['outgoing', 'incoming'] as const;

const propertySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  data_type: z.enum(DATA_TYPES),
  required: z.boolean().default(false),
  natural_key: z.boolean().default(false),
  enum_values: z.array(z.string()).nullable().optional(),
  geom_kind: z.enum(GEOM_KINDS).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const expectedEdgeSchema = z.object({
  edge_key: z.string().min(1),
  direction: z.enum(DIRECTIONS),
  target_type: z.string().min(1),
  obligation: z.enum(OBLIGATIONS),
  multiplicity: z.enum(MULTIPLICITIES),
  default_mode: z.enum(DEFAULT_MODES).nullable().optional(),
});

const subtypeSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
});

const edgePropSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  data_type: z.enum(DATA_TYPES),
  required: z.boolean().default(false),
  enum_values: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// Audit : auditSchema importé depuis ../audit.ts (alias 'audit')

// ─── Verrou helper (Décision N) ──────────────────────────────────────

async function assertNotLocked(type: 'type' | 'edge', key: string) {
  if (type === 'type') {
    const [row] = await sql`SELECT is_locked FROM config.schema_types WHERE key = ${key}`;
    if (row?.is_locked) {
      return { locked: true, message: `Type "${key}" verrouillé — élément structurel de l'ontologie. Modification impossible via l'API.` };
    }
  } else {
    const [row] = await sql`SELECT is_locked FROM config.schema_edges WHERE key = ${key}`;
    if (row?.is_locked) {
      return { locked: true, message: `Arête "${key}" verrouillée — élément structurel de l'ontologie. Modification impossible via l'API.` };
    }
  }
  return { locked: false };
}

// ─── Plugin ──────────────────────────────────────────────────────────

const schemaRoutes: FastifyPluginAsync = async (fastify) => {

  // ══════════════════════════════════════════════════════════════════
  // GET /schema — retourne tout, plat par table (Décision K)
  // ══════════════════════════════════════════════════════════════════

  fastify.get('/', async () => {
    const types = await sql`SELECT * FROM config.schema_types WHERE archived_at IS NULL ORDER BY key`;
    const properties = await sql`SELECT * FROM config.schema_properties WHERE archived_at IS NULL ORDER BY type_key, key`;
    const edges = await sql`SELECT * FROM config.schema_edges ORDER BY key`;
    const edge_properties = await sql`SELECT * FROM config.schema_edge_properties ORDER BY edge_key, key`;
    const universal_edge_properties = await sql`SELECT * FROM config.schema_universal_edge_properties ORDER BY key`;
    const expected_edges = await sql`SELECT * FROM config.schema_expected_edges WHERE archived_at IS NULL ORDER BY type_key, edge_key`;
    return { types, properties, edges, edge_properties, universal_edge_properties, expected_edges };
  });

  // ══════════════════════════════════════════════════════════════════
  // TYPES — sous-types uniquement (racines verrouillées)
  // ══════════════════════════════════════════════════════════════════

  // POST /schema/types/:parentKey/subtypes — ajouter un sous-type
  fastify.post('/types/:parentKey/subtypes', async (request, reply) => {
    const { parentKey } = request.params as { parentKey: string };
    const start = Date.now();

    const lock = await assertNotLocked('type', parentKey);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const parsed = subtypeSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const { key, label, description } = parsed.data;

    // Vérifier que le parent existe
    const [parent] = await sql`SELECT key FROM config.schema_types WHERE key = ${parentKey} AND archived_at IS NULL`;
    if (!parent) { reply.code(404); return { error: `Type parent "${parentKey}" non trouvé` }; }

    await sql`
      INSERT INTO config.schema_types (key, label, parent_key, description, is_locked)
      VALUES (${key}, ${label}, ${parentKey}, ${description ?? null}, false)
    `;

    await audit('INSERT', 'types', key, null, { key, label, parent_key: parentKey, description });
    fastify.log.info({ module: 'schema', action: 'INSERT', resource_type: 'types', resource_id: key, duration_ms: Date.now() - start }, 'subtype added');

    reply.code(201);
    return { key, label, parent_key: parentKey };
  });

  // PATCH /schema/types/:key — modifier label/description d'un sous-type
  fastify.patch('/types/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const start = Date.now();

    const lock = await assertNotLocked('type', key);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const body = request.body as { label?: string; description?: string };
    const [before] = await sql`SELECT * FROM config.schema_types WHERE key = ${key} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: `Type "${key}" non trouvé` }; }

    const label = body.label ?? before.label;
    const description = body.description !== undefined ? body.description : before.description;

    await sql`UPDATE config.schema_types SET label = ${label}, description = ${description} WHERE key = ${key}`;

    await audit('UPDATE', 'types', key, before, { ...before, label, description });
    fastify.log.info({ module: 'schema', action: 'UPDATE', resource_type: 'types', resource_id: key, duration_ms: Date.now() - start }, 'type updated');

    return { key, label, description };
  });

  // DELETE /schema/types/:key — archiver un sous-type
  fastify.delete('/types/:key', async (request, reply) => {
    const { key } = request.params as { key: string };
    const start = Date.now();

    const lock = await assertNotLocked('type', key);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const [before] = await sql`SELECT * FROM config.schema_types WHERE key = ${key} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: `Type "${key}" non trouvé` }; }

    await sql`UPDATE config.schema_types SET archived_at = now() WHERE key = ${key}`;

    await audit('DELETE', 'types', key, before, null);
    fastify.log.info({ module: 'schema', action: 'DELETE', resource_type: 'types', resource_id: key, duration_ms: Date.now() - start }, 'type archived');

    return { ok: true };
  });

  // ══════════════════════════════════════════════════════════════════
  // PROPERTIES — par type
  // ══════════════════════════════════════════════════════════════════

  // POST /schema/types/:typeKey/properties — ajouter une propriété
  fastify.post('/types/:typeKey/properties', async (request, reply) => {
    const { typeKey } = request.params as { typeKey: string };
    const start = Date.now();

    const lock = await assertNotLocked('type', typeKey);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const parsed = propertySchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const [{ id }] = await sql`
      INSERT INTO config.schema_properties (type_key, key, label, data_type, required, natural_key, enum_values, geom_kind, notes)
      VALUES (${typeKey}, ${data.key}, ${data.label}, ${data.data_type}, ${data.required},
              ${data.natural_key}, ${data.enum_values ? sql.json(data.enum_values) : null},
              ${data.geom_kind ?? null}, ${data.notes ?? null})
      RETURNING id
    `;

    await audit('INSERT', 'properties', id, null, { ...data, type_key: typeKey });
    fastify.log.info({ module: 'schema', action: 'INSERT', resource_type: 'properties', resource_id: id, duration_ms: Date.now() - start }, 'property added');

    reply.code(201);
    return { id, type_key: typeKey, ...data };
  });

  // PATCH /schema/properties/:uuid
  fastify.patch('/properties/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_properties WHERE id = ${uuid} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Propriété non trouvée' }; }

    const lock = await assertNotLocked('type', before.type_key as string);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const parsed = propertySchema.partial().safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const after = {
      label: data.label ?? before.label,
      data_type: data.data_type ?? before.data_type,
      required: data.required ?? before.required,
      natural_key: data.natural_key ?? before.natural_key,
      enum_values: data.enum_values !== undefined ? data.enum_values : before.enum_values,
      geom_kind: data.geom_kind !== undefined ? data.geom_kind : before.geom_kind,
      notes: data.notes !== undefined ? data.notes : before.notes,
    };

    await sql`
      UPDATE config.schema_properties
      SET label = ${after.label}, data_type = ${after.data_type}, required = ${after.required},
          natural_key = ${after.natural_key},
          enum_values = ${after.enum_values ? sql.json(after.enum_values) : null},
          geom_kind = ${after.geom_kind ?? null}, notes = ${after.notes ?? null}
      WHERE id = ${uuid}
    `;

    await audit('UPDATE', 'properties', uuid, before, after);
    fastify.log.info({ module: 'schema', action: 'UPDATE', resource_type: 'properties', resource_id: uuid, duration_ms: Date.now() - start }, 'property updated');

    return { id: uuid, ...after };
  });

  // DELETE /schema/properties/:uuid — archive
  fastify.delete('/properties/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_properties WHERE id = ${uuid} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Propriété non trouvée' }; }

    const lock = await assertNotLocked('type', before.type_key as string);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    await sql`UPDATE config.schema_properties SET archived_at = now() WHERE id = ${uuid}`;

    await audit('DELETE', 'properties', uuid, before, null);
    fastify.log.info({ module: 'schema', action: 'DELETE', resource_type: 'properties', resource_id: uuid, duration_ms: Date.now() - start }, 'property archived');

    return { ok: true };
  });

  // ══════════════════════════════════════════════════════════════════
  // EXPECTED EDGES — par type
  // ══════════════════════════════════════════════════════════════════

  // POST /schema/types/:typeKey/expected_edges
  fastify.post('/types/:typeKey/expected_edges', async (request, reply) => {
    const { typeKey } = request.params as { typeKey: string };
    const start = Date.now();

    const parsed = expectedEdgeSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const [{ id }] = await sql`
      INSERT INTO config.schema_expected_edges (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
      VALUES (${typeKey}, ${data.edge_key}, ${data.direction}, ${data.target_type},
              ${data.obligation}, ${data.multiplicity}, ${data.default_mode ?? null})
      RETURNING id
    `;

    await audit('INSERT', 'expected_edges', id, null, { ...data, type_key: typeKey });
    fastify.log.info({ module: 'schema', action: 'INSERT', resource_type: 'expected_edges', resource_id: id, duration_ms: Date.now() - start }, 'expected edge added');

    reply.code(201);
    return { id, type_key: typeKey, ...data };
  });

  // PATCH /schema/expected_edges/:uuid
  fastify.patch('/expected_edges/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_expected_edges WHERE id = ${uuid} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Arête attendue non trouvée' }; }

    const parsed = expectedEdgeSchema.partial().safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const after = {
      obligation: data.obligation ?? before.obligation,
      multiplicity: data.multiplicity ?? before.multiplicity,
      default_mode: data.default_mode !== undefined ? data.default_mode : before.default_mode,
    };

    await sql`
      UPDATE config.schema_expected_edges
      SET obligation = ${after.obligation}, multiplicity = ${after.multiplicity}, default_mode = ${after.default_mode ?? null}
      WHERE id = ${uuid}
    `;

    await audit('UPDATE', 'expected_edges', uuid, before, after);
    fastify.log.info({ module: 'schema', action: 'UPDATE', resource_type: 'expected_edges', resource_id: uuid, duration_ms: Date.now() - start }, 'expected edge updated');

    return { id: uuid, ...after };
  });

  // DELETE /schema/expected_edges/:uuid — archive
  fastify.delete('/expected_edges/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_expected_edges WHERE id = ${uuid} AND archived_at IS NULL`;
    if (!before) { reply.code(404); return { error: 'Arête attendue non trouvée' }; }

    await sql`UPDATE config.schema_expected_edges SET archived_at = now() WHERE id = ${uuid}`;

    await audit('DELETE', 'expected_edges', uuid, before, null);
    fastify.log.info({ module: 'schema', action: 'DELETE', resource_type: 'expected_edges', resource_id: uuid, duration_ms: Date.now() - start }, 'expected edge archived');

    return { ok: true };
  });

  // ══════════════════════════════════════════════════════════════════
  // EDGE PROPERTIES — par arête
  // ══════════════════════════════════════════════════════════════════

  // POST /schema/edges/:edgeKey/properties
  fastify.post('/edges/:edgeKey/properties', async (request, reply) => {
    const { edgeKey } = request.params as { edgeKey: string };
    const start = Date.now();

    const lock = await assertNotLocked('edge', edgeKey);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const parsed = edgePropSchema.safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const [{ id }] = await sql`
      INSERT INTO config.schema_edge_properties (edge_key, key, label, data_type, required, enum_values, notes)
      VALUES (${edgeKey}, ${data.key}, ${data.label}, ${data.data_type}, ${data.required},
              ${data.enum_values ? sql.json(data.enum_values) : null}, ${data.notes ?? null})
      RETURNING id
    `;

    await audit('INSERT', 'edge_properties', id, null, { ...data, edge_key: edgeKey });
    fastify.log.info({ module: 'schema', action: 'INSERT', resource_type: 'edge_properties', resource_id: id, duration_ms: Date.now() - start }, 'edge property added');

    reply.code(201);
    return { id, edge_key: edgeKey, ...data };
  });

  // PATCH /schema/edge_properties/:uuid
  fastify.patch('/edge_properties/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_edge_properties WHERE id = ${uuid}`;
    if (!before) { reply.code(404); return { error: 'Propriété d\'arête non trouvée' }; }

    const lock = await assertNotLocked('edge', before.edge_key as string);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    const parsed = edgePropSchema.partial().safeParse(request.body);
    if (!parsed.success) { reply.code(400); return { error: parsed.error.format() }; }
    const data = parsed.data;

    const after = {
      label: data.label ?? before.label,
      data_type: data.data_type ?? before.data_type,
      required: data.required ?? before.required,
      enum_values: data.enum_values !== undefined ? data.enum_values : before.enum_values,
      notes: data.notes !== undefined ? data.notes : before.notes,
    };

    await sql`
      UPDATE config.schema_edge_properties
      SET label = ${after.label}, data_type = ${after.data_type}, required = ${after.required},
          enum_values = ${after.enum_values ? sql.json(after.enum_values) : null},
          notes = ${after.notes ?? null}
      WHERE id = ${uuid}
    `;

    await audit('UPDATE', 'edge_properties', uuid, before, after);
    fastify.log.info({ module: 'schema', action: 'UPDATE', resource_type: 'edge_properties', resource_id: uuid, duration_ms: Date.now() - start }, 'edge property updated');

    return { id: uuid, ...after };
  });

  // DELETE /schema/edge_properties/:uuid
  fastify.delete('/edge_properties/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const start = Date.now();

    const [before] = await sql`SELECT * FROM config.schema_edge_properties WHERE id = ${uuid}`;
    if (!before) { reply.code(404); return { error: 'Propriété d\'arête non trouvée' }; }

    const lock = await assertNotLocked('edge', before.edge_key as string);
    if (lock.locked) { reply.code(403); return { error: lock.message }; }

    await sql`DELETE FROM config.schema_edge_properties WHERE id = ${uuid}`;

    await audit('DELETE', 'edge_properties', uuid, before, null);
    fastify.log.info({ module: 'schema', action: 'DELETE', resource_type: 'edge_properties', resource_id: uuid, duration_ms: Date.now() - start }, 'edge property deleted');

    return { ok: true };
  });
};

export default schemaRoutes;
