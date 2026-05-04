// ─── Routes Territoires — jalon 3 ────────────────────────────────
// Toutes les géométries Rhiza sont servies en SRID 2056 (LV95).
// Cohérence avec l'écosystème swisstopo/cantonal/RegBL.
// Le RFC 7946 recommande WGS84 mais autorise les CRS personnalisés
// via l'extension `crs`. Ajouter `?reproject=4326` si un client web
// généraliste le demande un jour (pas Sprint 1).

import { FastifyPluginAsync } from 'fastify';
import sql from '../db/postgres.js';
import { runCypher } from '../db/neo4j.js';

// ─── Helpers ─────────────────────────────────────────────────────

// Détermine dans quelle colonne stocker une valeur de propriété.
// typeof value === 'number' → value_number
// typeof value === 'string' → value_text
// sinon (objet, array, bool) → value_json
function propertyColumns(value: unknown) {
  if (typeof value === 'number') {
    return { value_text: null, value_number: value, value_json: null };
  }
  if (typeof value === 'string') {
    return { value_text: value, value_number: null, value_json: null };
  }
  return { value_text: null, value_number: null, value_json: JSON.stringify(value) };
}

interface PropertyInput {
  value: unknown;
  source?: string;
  confidence?: string;
}

// ─── Plugin ──────────────────────────────────────────────────────

const territoiresRoutes: FastifyPluginAsync = async (fastify) => {

  // ── GET /territoires/:uuid ─────────────────────────────────────
  // Assemble Postgres (territoire + propriétés courantes) + Neo4j (relations).
  // ?format=geojson → Feature GeoJSON avec propriétés imbriquées (value, source, confidence).
  //   Choix Rhiza : on ne perd pas la provenance dans le GeoJSON.
  //   Un GeoJSON web standard aplatirait les propriétés, mais pour Rhiza
  //   la source et la confiance sont aussi importantes que la valeur.

  fastify.get('/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    const { format } = request.query as { format?: string };

    // Territoire principal
    const [territoire] = await sql`
      SELECT uuid, nom, ST_AsGeoJSON(geom)::jsonb AS geom,
             created_at, archived_at
      FROM metier.territoires
      WHERE uuid = ${uuid}
    `;

    if (!territoire) {
      reply.code(404);
      return { error: 'Territoire not found' };
    }

    // Propriétés courantes
    const propsRows = await sql`
      SELECT property_name, value_text, value_number, value_json,
             source, confidence
      FROM metier.properties
      WHERE node_uuid = ${uuid} AND valid_to IS NULL
    `;

    const properties: Record<string, { value: unknown; source: string | null; confidence: string | null }> = {};
    for (const p of propsRows) {
      const value = p.value_number != null ? p.value_number
        : p.value_json != null ? p.value_json
        : p.value_text;
      properties[p.property_name] = {
        value,
        source: p.source,
        confidence: p.confidence,
      };
    }

    // Relations Neo4j
    const relations = await runCypher<{
      type: string;
      confidence: string | null;
      source: string | null;
      date: string | null;
      target_uuid: string;
      target_labels: string[];
      outgoing: boolean;
    }>(
      `MATCH (n:Territoire {uuid: $uuid})-[r]-(m)
       RETURN type(r) AS type, r.confidence AS confidence,
              r.source AS source, r.date AS date,
              m.uuid AS target_uuid, labels(m) AS target_labels,
              startNode(r).uuid = $uuid AS outgoing`,
      { uuid },
    );

    // Sortie GeoJSON
    if (format === 'geojson') {
      // Propriétés imbriquées avec provenance — choix Rhiza.
      // La source et la confiance sont aussi importantes que la valeur.
      // Ce n'est pas un GeoJSON web standard aplati.
      return {
        type: 'Feature',
        geometry: territoire.geom ?? null,
        properties: {
          uuid: territoire.uuid,
          nom: territoire.nom,
          created_at: territoire.created_at,
          archived_at: territoire.archived_at,
          ...properties,
          relations,
        },
      };
    }

    // Sortie JSON (défaut)
    return {
      uuid: territoire.uuid,
      nom: territoire.nom,
      geom: territoire.geom ?? null,
      created_at: territoire.created_at,
      archived_at: territoire.archived_at,
      properties,
      relations,
    };
  });

  // ── GET /territoires ───────────────────────────────────────────
  // ?type=Batiment → filtre par nature_history ILIKE 'Territoire:Batiment:%'
  // Sans type → tous les territoires actifs.
  // Deux requêtes distinctes selon la présence du filtre (plus sûr avec postgres.js).
  // Le ':' final dans le LIKE évite que ?type=Batiment matche BatimentDemoli.

  fastify.get('/', async (request) => {
    const { type } = request.query as { type?: string };

    let territoires;
    if (type) {
      const pattern = `Territoire:${type}:%`;
      territoires = await sql`
        SELECT t.uuid, t.nom, t.created_at, t.archived_at,
               p.value_text AS nature_history
        FROM metier.territoires t
        LEFT JOIN metier.properties p
          ON p.node_uuid = t.uuid
          AND p.property_name = 'nature_history'
          AND p.valid_to IS NULL
        WHERE t.archived_at IS NULL
          AND p.value_text ILIKE ${pattern}
        ORDER BY t.nom
      `;
    } else {
      territoires = await sql`
        SELECT t.uuid, t.nom, t.created_at, t.archived_at,
               p.value_text AS nature_history
        FROM metier.territoires t
        LEFT JOIN metier.properties p
          ON p.node_uuid = t.uuid
          AND p.property_name = 'nature_history'
          AND p.valid_to IS NULL
        WHERE t.archived_at IS NULL
        ORDER BY t.nom
      `;
    }

    return { territoires, total: territoires.length };
  });

  // ── POST /territoires ──────────────────────────────────────────
  // Crée un territoire en transaction : Postgres (territoires + properties) puis Neo4j.
  // Si Neo4j échoue, compensation DELETE Postgres.

  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      nom?: string;
      subtype?: string;
      geom?: Record<string, unknown>;
      srid?: number;
      parent_uuid?: string;
      properties?: Record<string, PropertyInput>;
    };

    // Validation minimale
    if (!body.nom || typeof body.nom !== 'string' || body.nom.trim() === '') {
      reply.code(400);
      return { error: 'nom est requis (string non vide)' };
    }
    if (!body.subtype || typeof body.subtype !== 'string' || !body.subtype.startsWith('Territoire:')) {
      reply.code(400);
      return { error: 'subtype est requis et doit commencer par "Territoire:"' };
    }
    if (body.srid != null && (typeof body.srid !== 'number' || !Number.isInteger(body.srid))) {
      reply.code(400);
      return { error: 'srid doit être un entier (ex: 2056, 4326)' };
    }

    const nom = body.nom.trim();
    const subtype = body.subtype;
    const srid = body.srid ?? 2056;
    const geomJson = body.geom ? JSON.stringify(body.geom) : null;

    let uuid: string;

    // 1. Transaction Postgres
    try {
      const result = await sql.begin(async (tx) => {
        // 1a. Insert territoire
        let inserted;
        if (geomJson && srid !== 2056) {
          // Reprojection depuis un CRS externe vers 2056
          [inserted] = await tx`
            INSERT INTO metier.territoires (nom, geom)
            VALUES (
              ${nom},
              ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), ${srid}), 2056)
            )
            RETURNING uuid
          `;
        } else if (geomJson) {
          // Déjà en 2056
          [inserted] = await tx`
            INSERT INTO metier.territoires (nom, geom)
            VALUES (
              ${nom},
              ST_SetSRID(ST_GeomFromGeoJSON(${geomJson}), 2056)
            )
            RETURNING uuid
          `;
        } else {
          // Pas de géométrie
          [inserted] = await tx`
            INSERT INTO metier.territoires (nom)
            VALUES (${nom})
            RETURNING uuid
          `;
        }

        const nodeUuid = inserted.uuid as string;

        // 1b. Insert nature_history
        await tx`
          INSERT INTO metier.properties (node_uuid, property_name, value_text, source, confidence)
          VALUES (${nodeUuid}, 'nature_history', ${subtype}, 'api', 'high')
        `;

        // 1c. Insert propriétés supplémentaires
        if (body.properties) {
          for (const [name, prop] of Object.entries(body.properties)) {
            const cols = propertyColumns(prop.value);
            await tx`
              INSERT INTO metier.properties
                (node_uuid, property_name, value_text, value_number, value_json, source, confidence)
              VALUES (
                ${nodeUuid}, ${name},
                ${cols.value_text}, ${cols.value_number}, ${cols.value_json ? sql.json(cols.value_json) : null},
                ${prop.source ?? null}, ${prop.confidence ?? null}
              )
            `;
          }
        }

        return nodeUuid;
      });

      uuid = result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // SRID invalide → PostGIS retourne une erreur
      if (msg.includes('transform') || msg.includes('SRID') || msg.includes('srid')) {
        reply.code(400);
        return { error: `SRID ${srid} invalide ou non supporté par PostGIS` };
      }
      throw err;
    }

    // 2. Neo4j — créer le nœud avec le même uuid + arête CONTENU_DANS si parent_uuid
    try {
      if (body.parent_uuid) {
        await runCypher(
          `CREATE (n:Territoire {uuid: $uuid})
           WITH n
           MATCH (parent:Territoire {uuid: $parentUuid})
           CREATE (n)-[:CONTENU_DANS {confidence: 'high', source: $source, date: datetime()}]->(parent)`,
          { uuid, parentUuid: body.parent_uuid, source: 'api' },
        );
      } else {
        await runCypher(
          'CREATE (n:Territoire {uuid: $uuid})',
          { uuid },
        );
      }
    } catch (err) {
      // Compensation : supprimer ce qui a été créé dans Postgres
      fastify.log.error({ module: 'territoires', err, uuid }, 'neo4j creation failed, compensating postgres');
      await sql`DELETE FROM metier.properties WHERE node_uuid = ${uuid}`;
      await sql`DELETE FROM metier.territoires WHERE uuid = ${uuid}`;
      throw err;
    }

    reply.code(201);
    return { uuid, nom, subtype };
  });
};

export default territoiresRoutes;
