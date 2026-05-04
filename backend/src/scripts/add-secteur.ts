// ─── Migration ponctuelle : ajout du type Secteur + expected edges ────
// Exception ponctuelle à la dette n°12 (seed binaire).
// Idempotent : vérifie l'existence avant d'insérer.
// Trace dans schema_audit avec source = 'migration'.
//
// Usage : npx tsx src/scripts/add-secteur.ts

import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

await migrate();

// ── 1. Type Secteur ──────────────────────────────────────────────────

const [existing] = await sql`SELECT key FROM config.schema_types WHERE key = 'Secteur'`;
if (existing) {
  console.log('⚠ Type Secteur déjà présent. Vérification des expected edges...');
} else {
  await sql`
    INSERT INTO config.schema_types (key, label, parent_key, description, is_locked)
    VALUES ('Secteur', 'Secteur', 'Territoire',
            'Délimitation infra-communale au sens OFS. Distincte du Quartier (cellule D SWICE).',
            false)
  `;
  await sql`
    INSERT INTO config.schema_properties (type_key, key, label, data_type, required, natural_key, geom_kind)
    VALUES ('Secteur', 'limite', 'Limite du secteur', 'geometry', false, false, 'polygon')
  `;
  // Audit
  const afterJson = JSON.stringify({ key: 'Secteur', label: 'Secteur', parent_key: 'Territoire' });
  await sql`
    INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
    VALUES ('INSERT', 'types', 'Secteur', ${afterJson}::jsonb, 'migration')
  `;
  console.log('  ✔ Type Secteur créé');
}

// ── 2. Expected edges ContenuDans manquantes ─────────────────────────
// Chaîne complète : Canton→Suisse, Commune→Canton, Secteur→Commune,
// Quartier→Secteur, Pièce→Unité (anciennement Logement)
// (Parcelle→Quartier, Bâtiment→Parcelle, Unité→Bâtiment existent déjà)

const EDGES_TO_ADD = [
  { type_key: 'Canton', target_type: 'Territoire', notes: 'Tout Canton est contenu dans la Suisse.' },
  { type_key: 'Commune', target_type: 'Canton', notes: 'Toute Commune est dans un Canton.' },
  { type_key: 'Secteur', target_type: 'Commune', notes: 'Tout Secteur est dans une Commune.' },
  { type_key: 'Quartier', target_type: 'Secteur', notes: 'Tout Quartier est dans un Secteur.' },
  { type_key: 'Pièce', target_type: 'Logement', notes: 'Toute Pièce est dans un Logement.' },
];

let addedCount = 0;
for (const ee of EDGES_TO_ADD) {
  const [exists] = await sql`
    SELECT id FROM config.schema_expected_edges
    WHERE type_key = ${ee.type_key}
      AND edge_key = 'ContenuDans'
      AND direction = 'outgoing'
      AND target_type = ${ee.target_type}
      AND archived_at IS NULL
  `;
  if (exists) {
    console.log(`  ⏭ ${ee.type_key} ContenuDans → ${ee.target_type} (déjà en place)`);
    continue;
  }

  const [{ id }] = await sql`
    INSERT INTO config.schema_expected_edges
      (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
    VALUES (${ee.type_key}, 'ContenuDans', 'outgoing', ${ee.target_type}, 'hard', 'one', 'linkOrCreateGeneric')
    RETURNING id
  `;

  const afterJson = JSON.stringify({ type_key: ee.type_key, edge_key: 'ContenuDans', target_type: ee.target_type });
  await sql`
    INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
    VALUES ('INSERT', 'expected_edges', ${id}, ${afterJson}::jsonb, 'migration')
  `;
  addedCount++;
  console.log(`  ✔ ${ee.type_key} ContenuDans → ${ee.target_type}`);
}

console.log(`\n✔ Migration terminée — ${addedCount} expected edges ajoutées`);
await sql.end();
