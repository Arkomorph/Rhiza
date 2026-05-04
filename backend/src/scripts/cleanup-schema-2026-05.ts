// ─── Migration ponctuelle : Logement → Unité + nettoyage schéma ──────
// Traite 4 corrections en UNE transaction :
// (a) Archive expected_edge Bâtiment ContenuDans Quartier (soft)
// (b) Archive Logement + insert Unité (type, propriétés, expected_edges)
//     + migre Pièce ContenuDans Logement → Pièce ContenuDans Unité
// (c) Corrige nature_history des 6 territoires Musy
// (d) Trace dans schema_audit
//
// Idempotent : vérifie l'état avant chaque modification.
//
// Usage : npx tsx src/scripts/cleanup-schema-2026-05.ts

import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

await migrate();

const SOURCE = 'migration-cleanup-2026-05';

await sql.begin(async (tx) => {
  console.log('── Cleanup schema Mai 2026 ──────────────────────────');

  // ─── (a) Archive expected_edge Bâtiment ContenuDans Quartier (soft) ──
  {
    const [existing] = await tx`
      SELECT id FROM config.schema_expected_edges
      WHERE type_key = 'Bâtiment'
        AND edge_key = 'ContenuDans'
        AND target_type = 'Quartier'
        AND archived_at IS NULL
    `;
    if (existing) {
      await tx`
        UPDATE config.schema_expected_edges
        SET archived_at = now()
        WHERE id = ${existing.id}
      `;
      await tx`
        INSERT INTO config.schema_audit (action, resource_type, resource_id, before, source)
        VALUES ('DELETE', 'expected_edges', ${existing.id},
          ${JSON.stringify({ type_key: 'Bâtiment', edge_key: 'ContenuDans', target_type: 'Quartier', obligation: 'soft' })}::jsonb,
          ${SOURCE})
      `;
      console.log('  ✔ (a) Archivé : Bâtiment ContenuDans Quartier (soft)');
    } else {
      console.log('  ⏭ (a) Bâtiment ContenuDans Quartier (soft) — déjà archivé ou absent');
    }
  }

  // ─── (b) Archive Logement + insert Unité ─────────────────────────────
  {
    // Vérifier si Logement existe encore (non archivé)
    const [logement] = await tx`
      SELECT key FROM config.schema_types
      WHERE key = 'Logement' AND archived_at IS NULL
    `;
    const [unite] = await tx`
      SELECT key FROM config.schema_types
      WHERE key = 'Unité' AND archived_at IS NULL
    `;

    if (logement && !unite) {
      // Archive le type Logement
      await tx`
        UPDATE config.schema_types
        SET archived_at = now()
        WHERE key = 'Logement'
      `;
      await tx`
        INSERT INTO config.schema_audit (action, resource_type, resource_id, before, source)
        VALUES ('DELETE', 'types', 'Logement',
          ${JSON.stringify({ key: 'Logement', label: 'Logement', parent_key: 'Territoire' })}::jsonb,
          ${SOURCE})
      `;

      // Insert le type Unité
      await tx`
        INSERT INTO config.schema_types (key, label, parent_key, description, is_locked)
        VALUES ('Unité', 'Unité', 'Territoire',
          'Subdivision fonctionnelle d''un Bâtiment. Neutre sur la fonction (habitation, commerce, industrie). La fonction du Bâtiment est une propriété, pas un sous-type (D8, D14).',
          false)
      `;
      await tx`
        INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
        VALUES ('INSERT', 'types', 'Unité',
          ${JSON.stringify({ key: 'Unité', label: 'Unité', parent_key: 'Territoire', reason: 'D14 — Logement renommé Unité' })}::jsonb,
          ${SOURCE})
      `;

      // Migrer les propriétés de Logement → Unité
      const logementProps = await tx`
        SELECT id, key, label, data_type, required, natural_key, enum_values, geom_kind, notes
        FROM config.schema_properties
        WHERE type_key = 'Logement' AND archived_at IS NULL
      `;
      for (const p of logementProps) {
        // Archive l'ancienne
        await tx`
          UPDATE config.schema_properties SET archived_at = now() WHERE id = ${p.id}
        `;
        // Insert la nouvelle sous Unité
        await tx`
          INSERT INTO config.schema_properties (type_key, key, label, data_type, required, natural_key, enum_values, geom_kind, notes)
          VALUES ('Unité', ${p.key}, ${p.label}, ${p.data_type}, ${p.required}, ${p.natural_key}, ${p.enum_values}, ${p.geom_kind}, ${p.notes})
        `;
      }
      console.log(`  ✔ (b) ${logementProps.length} propriétés migrées Logement → Unité`);

      // Migrer les expected_edges de Logement → Unité
      const logementEdges = await tx`
        SELECT id, edge_key, direction, target_type, obligation, multiplicity, default_mode
        FROM config.schema_expected_edges
        WHERE type_key = 'Logement' AND archived_at IS NULL
      `;
      for (const ee of logementEdges) {
        await tx`
          UPDATE config.schema_expected_edges SET archived_at = now() WHERE id = ${ee.id}
        `;
        await tx`
          INSERT INTO config.schema_expected_edges (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
          VALUES ('Unité', ${ee.edge_key}, ${ee.direction}, ${ee.target_type}, ${ee.obligation}, ${ee.multiplicity}, ${ee.default_mode})
        `;
      }
      console.log(`  ✔ (b) ${logementEdges.length} expected_edges migrées Logement → Unité`);

      // Migrer Pièce ContenuDans Logement → Pièce ContenuDans Unité
      const [pieceEdge] = await tx`
        SELECT id FROM config.schema_expected_edges
        WHERE type_key = 'Pièce'
          AND edge_key = 'ContenuDans'
          AND target_type = 'Logement'
          AND archived_at IS NULL
      `;
      if (pieceEdge) {
        await tx`
          UPDATE config.schema_expected_edges SET archived_at = now() WHERE id = ${pieceEdge.id}
        `;
        await tx`
          INSERT INTO config.schema_expected_edges (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
          VALUES ('Pièce', 'ContenuDans', 'outgoing', 'Unité', 'hard', 'one', 'linkOrCreateGeneric')
        `;
        await tx`
          INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
          VALUES ('UPDATE', 'expected_edges', 'Pièce-ContenuDans',
            ${JSON.stringify({ from: 'Pièce ContenuDans Logement', to: 'Pièce ContenuDans Unité' })}::jsonb,
            ${SOURCE})
        `;
        console.log('  ✔ (b) Pièce ContenuDans Logement → Pièce ContenuDans Unité');
      } else {
        console.log('  ⏭ (b) Pièce ContenuDans Logement — déjà migré ou absent');
      }

      console.log('  ✔ (b) Logement archivé, Unité créé');
    } else if (unite) {
      console.log('  ⏭ (b) Unité déjà présent — skip');
    } else {
      console.log('  ⏭ (b) Logement absent — rien à migrer');
    }
  }

  // ─── (c) Corrige nature_history des territoires Musy ─────────────────
  {
    const corrections: Array<{ nom: string; bad: string; good: string }> = [
      { nom: 'Schoenberg', bad: 'Territoire:', good: 'Territoire:Secteur:' },
      // Musy 3 et Musy 5 — accent manquant sur Batiment
    ];

    // Trouver les territoires avec Batiment sans accent
    const batimentSansAccent = await tx`
      SELECT tp.id, tp.entity_uuid, tp.value
      FROM config.territory_properties tp
      WHERE tp.property_name = 'nature_history'
        AND tp.value LIKE '%Batiment%'
        AND tp.valid_to IS NULL
    `;
    for (const row of batimentSansAccent) {
      const fixed = (row.value as string).replace('Batiment', 'Bâtiment');
      corrections.push({ nom: `uuid:${row.entity_uuid}`, bad: row.value as string, good: fixed });
    }

    // Trouver Schoenberg avec nature_history "Territoire:" (sans sous-type)
    const schoenberg = await tx`
      SELECT tp.id, tp.entity_uuid, tp.value
      FROM config.territory_properties tp
      WHERE tp.property_name = 'nature_history'
        AND tp.value = 'Territoire:'
        AND tp.valid_to IS NULL
    `;

    let corrected = 0;

    for (const row of schoenberg) {
      await tx`
        UPDATE config.territory_properties
        SET valid_to = now()
        WHERE id = ${row.id}
      `;
      await tx`
        INSERT INTO config.territory_properties (entity_uuid, property_name, value, source, confidence, valid_from)
        VALUES (${row.entity_uuid}, 'nature_history', 'Territoire:Secteur:', ${SOURCE}, 'high', now())
      `;
      corrected++;
      console.log(`  ✔ (c) Schoenberg nature_history: Territoire: → Territoire:Secteur:`);
    }

    for (const row of batimentSansAccent) {
      const fixed = (row.value as string).replace('Batiment', 'Bâtiment');
      await tx`
        UPDATE config.territory_properties
        SET valid_to = now()
        WHERE id = ${row.id}
      `;
      await tx`
        INSERT INTO config.territory_properties (entity_uuid, property_name, value, source, confidence, valid_from)
        VALUES (${row.entity_uuid}, 'nature_history', ${fixed}, ${SOURCE}, 'high', now())
      `;
      corrected++;
      console.log(`  ✔ (c) ${row.entity_uuid} nature_history: ${row.value} → ${fixed}`);
    }

    if (corrected === 0) {
      console.log('  ⏭ (c) Aucune nature_history à corriger');
    } else {
      await tx`
        INSERT INTO config.schema_audit (action, resource_type, resource_id, after, source)
        VALUES ('UPDATE', 'territory_properties', 'nature_history',
          ${JSON.stringify({ corrections: corrected, reason: 'fix Schoenberg sans Secteur + Batiment sans accent' })}::jsonb,
          ${SOURCE})
      `;
    }
  }

  console.log('\n✔ Cleanup terminé — transaction commitée');
});

await sql.end();
