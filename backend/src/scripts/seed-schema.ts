// ─── Seed Schema — Jalon 5 Sprint 2 ─────────────────────────────────
// Peuple les 6 tables config.schema_* en lisant DIRECTEMENT les modules
// JS frontend (source de vérité). Pas de transcription manuelle.
//
// Usage : npx tsx src/scripts/seed-schema.ts
//   ou via docker run avec volume mount pour les fichiers JS frontend

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(__dirname, '../../../frontend/src/data');

// ─── Loader JS (même pattern que diff-schema.ts) ────────────────────

function loadJsModule(filename: string): Record<string, unknown> {
  const code = readFileSync(resolve(FRONTEND, filename), 'utf-8');
  const wrapped = code
    .replace(/export\s+const\s+(\w+)\s*=/g, '__exports.$1 =')
    .replace(/export\s+default\s+/g, '__exports.default = ');
  const fn = new Function('__exports', wrapped);
  const exports: Record<string, unknown> = {};
  fn(exports);
  return exports;
}

// ─── Types ───────────────────────────────────────────────────────────

interface JsNode {
  key: string;
  label: string;
  description?: string;
  props?: Array<{
    key: string; label: string; type: string;
    natural_key?: boolean; enum_values?: Array<string | { value: string }>;
    geomKind?: string; notes?: string;
  }>;
  expectedEdges?: Array<{
    edgeKey: string; direction: string; otherSide: string[];
    obligation: string; multiplicity: string; defaultMode: string;
  }>;
  children?: Record<string, JsNode>;
}

interface JsEdge {
  key: string; label: string; from: string; to: string;
  description?: string;
  specific_props?: Array<{
    key: string; label: string; type: string;
    obligatoire?: boolean; enum_values?: string[];
    notes?: string;
  }>;
}

// ─── Main ────────────────────────────────────────────────────────────

await migrate();

const [{ count }] = await sql`SELECT count(*)::int AS count FROM config.schema_types`;
if (count > 0) {
  console.log(`⚠ Schema déjà peuplé (${count} types). Abandon.`);
  await sql.end();
  process.exit(0);
}

const ontologyExports = loadJsModule('ontology.js');
const edgeTypesExports = loadJsModule('edge-types.js');

const tree = ontologyExports.INITIAL_ONTOLOGY_TREE as Record<string, JsNode>;
const edgeTypes = edgeTypesExports.INITIAL_EDGE_TYPES as JsEdge[];

console.log('Seed schema depuis les modules JS frontend...');

// ── 1. Types (parcours récursif, racines d'abord pour FK parent_key) ──

let typeCount = 0;
let propCount = 0;
let expectedEdgeCount = 0;

async function walkNode(node: JsNode, parentKey: string | null, isRoot: boolean) {
  await sql`
    INSERT INTO config.schema_types (key, label, parent_key, description, is_locked)
    VALUES (${node.key}, ${node.label}, ${parentKey}, ${node.description ?? null}, ${isRoot})
  `;
  typeCount++;

  // Propriétés intrinsèques
  for (const p of node.props ?? []) {
    const enumVals = p.enum_values
      ? p.enum_values.map(v => typeof v === 'string' ? v : v.value)
      : null;
    await sql`
      INSERT INTO config.schema_properties (type_key, key, label, data_type, required, natural_key, enum_values, geom_kind, notes)
      VALUES (${node.key}, ${p.key}, ${p.label}, ${p.type}, ${false}, ${p.natural_key ?? false},
              ${enumVals ? sql.json(enumVals) : null}, ${p.geomKind ?? null}, ${p.notes ?? null})
    `;
    propCount++;
  }

  // Expected edges
  for (const ee of node.expectedEdges ?? []) {
    const targetType = ee.otherSide[ee.otherSide.length - 1];
    await sql`
      INSERT INTO config.schema_expected_edges (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
      VALUES (${node.key}, ${ee.edgeKey}, ${ee.direction}, ${targetType}, ${ee.obligation}, ${ee.multiplicity}, ${ee.defaultMode})
    `;
    expectedEdgeCount++;
  }

  // Enfants
  for (const child of Object.values(node.children ?? {})) {
    await walkNode(child, node.key, false);
  }
}

for (const root of Object.values(tree)) {
  await walkNode(root, null, true);
}
console.log(`  ✔ ${typeCount} types`);
console.log(`  ✔ ${propCount} propriétés intrinsèques`);
console.log(`  ✔ ${expectedEdgeCount} arêtes attendues`);

// ── 2. Arêtes ──

for (const e of edgeTypes) {
  await sql`
    INSERT INTO config.schema_edges (key, label, from_type, to_type, description)
    VALUES (${e.key}, ${e.label}, ${e.from}, ${e.to}, ${e.description ?? null})
  `;
}
console.log(`  ✔ ${edgeTypes.length} arêtes`);

// ── 3. Propriétés spécifiques par arête ──

let edgePropCount = 0;
for (const e of edgeTypes) {
  for (const p of e.specific_props ?? []) {
    await sql`
      INSERT INTO config.schema_edge_properties (edge_key, key, label, data_type, required, enum_values, notes)
      VALUES (${e.key}, ${p.key}, ${p.label}, ${p.type}, ${p.obligatoire ?? false},
              ${p.enum_values ? sql.json(p.enum_values) : null}, ${p.notes ?? null})
    `;
    edgePropCount++;
  }
}
console.log(`  ✔ ${edgePropCount} propriétés d'arête`);

// ── 4. Propriétés universelles d'arête ──
// Ces 6 propriétés sont dans le code du proto, pas dans un export JS.
// On les insère en dur — elles sont stables par design (D11).

const UNIVERSAL = [
  { key: "source", label: "Source", data_type: "string", required: true, notes: "Origine de l'information" },
  { key: "confidence", label: "Confiance", data_type: "enum", required: true, enum_values: ["high", "medium", "low", "inferred"], notes: null },
  { key: "date", label: "Date", data_type: "date", required: true, notes: "Création ou dernière vérification" },
  { key: "valid_from", label: "Valide depuis", data_type: "datetime", required: false, notes: "Début de validité bi-temporelle" },
  { key: "valid_to", label: "Valide jusqu'à", data_type: "datetime", required: false, notes: "Fin de validité (NULL = courant)" },
  { key: "exec_id", label: "ID exécution", data_type: "string", required: false, notes: "Identifiant de l'import source" },
];
for (const p of UNIVERSAL) {
  await sql`
    INSERT INTO config.schema_universal_edge_properties (key, label, data_type, required, enum_values, notes)
    VALUES (${p.key}, ${p.label}, ${p.data_type}, ${p.required},
            ${p.enum_values ? sql.json(p.enum_values) : null}, ${p.notes})
  `;
}
console.log(`  ✔ ${UNIVERSAL.length} propriétés universelles`);

console.log('\n✔ Seed schema terminé');
await sql.end();
