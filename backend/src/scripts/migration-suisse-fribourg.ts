// ─── Migration D15 — Suisse + Canton FR + Commune FR + re-parent Schönberg ──
// Complète la chaîne spatiale CONTENU_DANS ascendante.
// Idempotent : vérifie l'existence avant chaque opération.
// Trace dans schema_audit avec source = 'migration-D15-2026-05-05'.
//
// Usage : via docker run sur le VPS (même pattern que seed-musy.ts)

import sql from '../db/postgres.js';
import { runCypher } from '../db/neo4j.js';
import { migrate } from '../db/migrate.js';

const SOURCE = 'migration';
const API = process.env.API_BASE
  ? `${process.env.API_BASE}/territoires`
  : 'http://localhost:3000/territoires';

// ─── Helpers ─────────────────────────────────────────────────────────

async function post(body: Record<string, unknown>): Promise<{ uuid: string }> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST /territoires failed (${res.status}): ${text}`);
  }
  return await res.json() as { uuid: string };
}

async function auditLog(action: string, resourceType: string, resourceId: string, detail: Record<string, unknown>) {
  const detailJson = JSON.stringify(detail);
  await sql`
    INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
    VALUES (${action}, ${resourceType}, ${resourceId}, ${detailJson}::jsonb, ${SOURCE})
  `;
}

// ─── Main ────────────────────────────────────────────────────────────

await migrate();

console.log('Migration D15 — Suisse + Canton FR + Commune FR + re-parent Schönberg\n');

// ── (a) Créer Suisse ─────────────────────────────────────────────────

let suisseUuid: string;

const [existingSuisse] = await sql`
  SELECT t.uuid FROM metier.territoires t
  JOIN metier.properties p ON p.node_uuid = t.uuid
  WHERE p.property_name = 'nature_history' AND p.value_text = 'Territoire:' AND p.valid_to IS NULL
`;

if (existingSuisse) {
  suisseUuid = existingSuisse.uuid as string;
  console.log(`  ⏭ Suisse existe déjà : ${suisseUuid}`);
} else {
  // Créer directement en base (pas via API — Suisse n'a pas de parent_uuid)
  const [inserted] = await sql`
    INSERT INTO metier.territoires (nom) VALUES ('Suisse') RETURNING uuid
  `;
  suisseUuid = inserted.uuid as string;

  await sql`
    INSERT INTO metier.properties (node_uuid, property_name, value_text, source, confidence)
    VALUES (${suisseUuid}, 'nature_history', 'Territoire:', ${SOURCE}, 'high')
  `;

  // Neo4j
  await runCypher('CREATE (n:Territoire {uuid: $uuid})', { uuid: suisseUuid });

  await auditLog('INSERT', 'types', suisseUuid, { nom: 'Suisse', nature_history: 'Territoire:', note: 'D15 — Suisse devient un vrai nœud Territoire' });
  console.log(`  ✔ Suisse créée : ${suisseUuid}`);
}

// ── (b) Créer Canton Fribourg via API ────────────────────────────────

let cantonUuid: string;

const [existingCanton] = await sql`
  SELECT t.uuid FROM metier.territoires t
  JOIN metier.properties p ON p.node_uuid = t.uuid
  WHERE t.nom = 'Fribourg' AND p.property_name = 'nature_history' AND p.value_text = 'Territoire:Canton:' AND p.valid_to IS NULL
`;

if (existingCanton) {
  cantonUuid = existingCanton.uuid as string;
  console.log(`  ⏭ Canton Fribourg existe déjà : ${cantonUuid}`);
} else {
  const result = await post({
    nom: 'Fribourg',
    subtype: 'Territoire:Canton:',
    parent_uuid: suisseUuid,
    properties: {
      code: { value: 'FR', source: SOURCE, confidence: 'high' },
    },
  });
  cantonUuid = result.uuid;
  console.log(`  ✔ Canton Fribourg créé : ${cantonUuid}`);
}

// ── (c) Créer Commune Fribourg via API ───────────────────────────────

let communeUuid: string;

const [existingCommune] = await sql`
  SELECT t.uuid FROM metier.territoires t
  JOIN metier.properties p ON p.node_uuid = t.uuid
  WHERE t.nom = 'Fribourg' AND p.property_name = 'nature_history' AND p.value_text = 'Territoire:Commune:' AND p.valid_to IS NULL
`;

if (existingCommune) {
  communeUuid = existingCommune.uuid as string;
  console.log(`  ⏭ Commune Fribourg existe déjà : ${communeUuid}`);
} else {
  const result = await post({
    nom: 'Fribourg',
    subtype: 'Territoire:Commune:',
    parent_uuid: cantonUuid,
    properties: {
      ofs_id: { value: '2196', source: SOURCE, confidence: 'high' },
    },
  });
  communeUuid = result.uuid;
  console.log(`  ✔ Commune Fribourg créée : ${communeUuid}`);
}

// ── (d) Re-parent Schönberg → Commune Fribourg ──────────────────────
// Exception ponctuelle Cypher direct (dette n°17 — pas de route PATCH)

const SCHOENBERG_UUID = '345b30f0-014a-47e2-b8c3-220489e3ceea';

// Vérifier si Schönberg est déjà lié à la Commune
const [existingLink] = await runCypher<{ parentUuid: string }>(
  `MATCH (s:Territoire {uuid: $uuid})-[:CONTENU_DANS]->(p:Territoire {uuid: $communeUuid})
   RETURN p.uuid AS parentUuid`,
  { uuid: SCHOENBERG_UUID, communeUuid },
);

if (existingLink) {
  console.log(`  ⏭ Schönberg déjà lié à Commune Fribourg`);
} else {
  // Supprimer l'arête existante (si elle existe)
  await runCypher(
    'MATCH (s:Territoire {uuid: $uuid})-[r:CONTENU_DANS]->() DELETE r',
    { uuid: SCHOENBERG_UUID },
  );

  // Créer la nouvelle arête vers Commune
  await runCypher(
    `MATCH (s:Territoire {uuid: $uuid}), (c:Territoire {uuid: $communeUuid})
     CREATE (s)-[:CONTENU_DANS {confidence: 'high', source: $source, date: datetime()}]->(c)`,
    { uuid: SCHOENBERG_UUID, communeUuid, source: SOURCE },
  );

  await auditLog('UPDATE', 'types', SCHOENBERG_UUID, {
    action: 're-parent',
    old_parent: 'racine (orphelin)',
    new_parent: communeUuid,
    note: 'Exception ponctuelle Cypher direct (dette n°17)',
  });
  console.log(`  ✔ Schönberg re-parenté → Commune Fribourg`);
}

console.log('\n✔ Migration D15 terminée');
await sql.end();
