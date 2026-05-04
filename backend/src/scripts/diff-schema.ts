// ─── Diff Schema — Compare JS source vs PostgreSQL ──────────────────
// Compare le contenu de ontology.js, edge-types.js et derived-props.js
// avec les tables config.schema_* en base.
//
// Usage : npx tsx src/scripts/diff-schema.ts
//   ou via docker run avec volume mount pour les fichiers JS

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from '../db/postgres.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND = resolve(__dirname, '../../../frontend/src/data');

// ─── 1. EXTRACTION DEPUIS LA SOURCE JS ──────────────────────────────
// On ne peut pas importer les ESM React directement dans un script Node
// sans bundler. On parse le JS via Function() pour extraire les exports.

function loadJsModule(filename: string): Record<string, unknown> {
  const code = readFileSync(resolve(FRONTEND, filename), 'utf-8');
  // Transforme `export const X = ...` en `__exports.X = ...`
  const wrapped = code
    .replace(/export\s+const\s+(\w+)\s*=/g, '__exports.$1 =')
    .replace(/export\s+default\s+/g, '__exports.default = ');
  const fn = new Function('__exports', wrapped);
  const exports: Record<string, unknown> = {};
  fn(exports);
  return exports;
}

interface JsProp {
  key: string;
  label: string;
  type: string;
  natural_key?: boolean;
  enum_values?: Array<string | { value: string }>;
  geomKind?: string;
  notes?: string;
}

interface JsExpectedEdge {
  edgeKey: string;
  direction: string;
  otherSide: string[];
  obligation: string;
  multiplicity: string;
  defaultMode: string;
}

interface JsNode {
  key: string;
  label: string;
  description?: string;
  props?: JsProp[];
  expectedEdges?: JsExpectedEdge[];
  children?: Record<string, JsNode>;
}

interface JsEdge {
  key: string;
  label: string;
  from: string;
  to: string;
  description?: string;
  props?: Array<{ key: string; label: string; type: string; required?: boolean; enum_values?: unknown[]; notes?: string }>;
}

// Flatten ontology tree → types + props + expected edges
interface FlatType { key: string; label: string; parent_key: string | null; description: string | null }
interface FlatProp { type_key: string; key: string; label: string; data_type: string; natural_key: boolean; enum_values: string[] | null; geom_kind: string | null }
interface FlatExpectedEdge { type_key: string; edge_key: string; direction: string; target_type: string; obligation: string; multiplicity: string; default_mode: string }

function flattenTree(tree: Record<string, JsNode>) {
  const types: FlatType[] = [];
  const props: FlatProp[] = [];
  const expectedEdges: FlatExpectedEdge[] = [];

  function walk(node: JsNode, parentKey: string | null) {
    types.push({ key: node.key, label: node.label, parent_key: parentKey, description: node.description ?? null });

    for (const p of node.props ?? []) {
      const enumVals = p.enum_values
        ? p.enum_values.map(v => typeof v === 'string' ? v : v.value)
        : null;
      props.push({
        type_key: node.key,
        key: p.key,
        label: p.label,
        data_type: p.type,
        natural_key: p.natural_key ?? false,
        enum_values: enumVals,
        geom_kind: p.geomKind ?? null,
      });
    }

    for (const ee of node.expectedEdges ?? []) {
      // target_type = last element of otherSide path
      const targetType = ee.otherSide[ee.otherSide.length - 1];
      expectedEdges.push({
        type_key: node.key,
        edge_key: ee.edgeKey,
        direction: ee.direction,
        target_type: targetType,
        obligation: ee.obligation,
        multiplicity: ee.multiplicity,
        default_mode: ee.defaultMode,
      });
    }

    for (const child of Object.values(node.children ?? {})) {
      walk(child, node.key);
    }
  }

  for (const root of Object.values(tree)) {
    walk(root, null);
  }

  return { types, props, expectedEdges };
}

// ─── 2. EXTRACTION DEPUIS LA BASE ───────────────────────────────────

async function loadDb() {
  const types = await sql`SELECT key, label, parent_key, description FROM config.schema_types WHERE archived_at IS NULL ORDER BY key`;
  const props = await sql`SELECT type_key, key, label, data_type, natural_key, enum_values, geom_kind FROM config.schema_properties WHERE archived_at IS NULL ORDER BY type_key, key`;
  const edges = await sql`SELECT key, label, from_type, to_type, description FROM config.schema_edges ORDER BY key`;
  const edgeProps = await sql`SELECT edge_key, key, label, data_type, required, enum_values FROM config.schema_edge_properties ORDER BY edge_key, key`;
  const universalProps = await sql`SELECT key, label, data_type, required, enum_values FROM config.schema_universal_edge_properties ORDER BY key`;
  const expectedEdges = await sql`SELECT type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode FROM config.schema_expected_edges WHERE archived_at IS NULL ORDER BY type_key, edge_key`;
  return { types, props, edges, edgeProps, universalProps, expectedEdges };
}

// ─── 3. DIFF ────────────────────────────────────────────────────────

type Diff = { category: string; issue: string };

function diffArrays<T>(
  category: string,
  jsItems: T[],
  dbItems: Record<string, unknown>[],
  keyFn: (item: T) => string,
  dbKeyFn: (item: Record<string, unknown>) => string,
  compareFn: (js: T, db: Record<string, unknown>) => string[],
): Diff[] {
  const diffs: Diff[] = [];
  const jsMap = new Map(jsItems.map(i => [keyFn(i), i]));
  const dbMap = new Map(dbItems.map(i => [dbKeyFn(i), i]));

  for (const [k, js] of jsMap) {
    if (!dbMap.has(k)) {
      diffs.push({ category, issue: `MISSING IN DB: ${k}` });
    } else {
      const fieldDiffs = compareFn(js, dbMap.get(k)!);
      for (const fd of fieldDiffs) {
        diffs.push({ category, issue: `MISMATCH ${k}: ${fd}` });
      }
    }
  }

  for (const k of dbMap.keys()) {
    if (!jsMap.has(k)) {
      diffs.push({ category, issue: `EXTRA IN DB: ${k}` });
    }
  }

  return diffs;
}

// ─── 4. MAIN ────────────────────────────────────────────────────────

console.log('Loading JS sources...');
const ontologyExports = loadJsModule('ontology.js');
const edgeTypesExports = loadJsModule('edge-types.js');
const derivedExports = loadJsModule('derived-props.js');

const tree = ontologyExports.INITIAL_ONTOLOGY_TREE as Record<string, JsNode>;
const jsEdgeTypes = edgeTypesExports.INITIAL_EDGE_TYPES as JsEdge[];
const jsDerived = derivedExports.initialDerivedProps as unknown[];
const jsUniversalProps = edgeTypesExports.UNIVERSAL_EDGE_PROPS as Array<{ key: string; label: string; type: string; required?: boolean }>;

const { types: jsTypes, props: jsProps, expectedEdges: jsExpectedEdges } = flattenTree(tree);

console.log(`JS source: ${jsTypes.length} types, ${jsProps.length} props, ${jsEdgeTypes.length} edges, ${jsExpectedEdges.length} expected edges, ${jsDerived?.length ?? '?'} derived props, ${jsUniversalProps?.length ?? '?'} universal edge props`);

console.log('\nLoading database...');
const db = await loadDb();

console.log(`Database:  ${db.types.length} types, ${db.props.length} props, ${db.edges.length} edges, ${db.expectedEdges.length} expected edges, ${db.universalProps.length} universal edge props, ${db.edgeProps.length} edge-specific props`);

// ── Run diffs ──
const allDiffs: Diff[] = [];

// Types
allDiffs.push(...diffArrays(
  'TYPES',
  jsTypes,
  db.types,
  t => t.key,
  t => t.key as string,
  (js, db) => {
    const d: string[] = [];
    if (js.label !== db.label) d.push(`label: JS="${js.label}" DB="${db.label}"`);
    if ((js.parent_key ?? null) !== (db.parent_key ?? null)) d.push(`parent_key: JS="${js.parent_key}" DB="${db.parent_key}"`);
    return d;
  },
));

// Properties
allDiffs.push(...diffArrays(
  'PROPERTIES',
  jsProps,
  db.props,
  p => `${p.type_key}::${p.key}`,
  p => `${p.type_key}::${p.key}`,
  (js, db) => {
    const d: string[] = [];
    if (js.label !== db.label) d.push(`label: JS="${js.label}" DB="${db.label}"`);
    if (js.data_type !== db.data_type) d.push(`data_type: JS="${js.data_type}" DB="${db.data_type}"`);
    if (js.natural_key !== db.natural_key) d.push(`natural_key: JS=${js.natural_key} DB=${db.natural_key}`);
    if (js.geom_kind !== (db.geom_kind ?? null)) d.push(`geom_kind: JS="${js.geom_kind}" DB="${db.geom_kind}"`);
    // Compare enum values
    const jsEnum = js.enum_values ? JSON.stringify(js.enum_values.sort()) : null;
    const dbEnum = db.enum_values ? JSON.stringify((db.enum_values as string[]).sort()) : null;
    if (jsEnum !== dbEnum) d.push(`enum_values differ`);
    return d;
  },
));

// Edges
allDiffs.push(...diffArrays(
  'EDGES',
  jsEdgeTypes,
  db.edges,
  e => e.key,
  e => e.key as string,
  (js, db) => {
    const d: string[] = [];
    if (js.label !== db.label) d.push(`label: JS="${js.label}" DB="${db.label}"`);
    if (js.from !== db.from_type) d.push(`from: JS="${js.from}" DB="${db.from_type}"`);
    if (js.to !== db.to_type) d.push(`to: JS="${js.to}" DB="${db.to_type}"`);
    return d;
  },
));

// Expected edges
allDiffs.push(...diffArrays(
  'EXPECTED_EDGES',
  jsExpectedEdges,
  db.expectedEdges,
  e => `${e.type_key}|${e.edge_key}|${e.direction}|${e.target_type}`,
  e => `${e.type_key}|${e.edge_key}|${e.direction}|${e.target_type}`,
  (js, db) => {
    const d: string[] = [];
    if (js.obligation !== db.obligation) d.push(`obligation: JS="${js.obligation}" DB="${db.obligation}"`);
    if (js.multiplicity !== db.multiplicity) d.push(`multiplicity: JS="${js.multiplicity}" DB="${db.multiplicity}"`);
    if (js.default_mode !== db.default_mode) d.push(`default_mode: JS="${js.default_mode}" DB="${db.default_mode}"`);
    return d;
  },
));

// ── Report ──
console.log('\n════════════════════════════════════════════');
console.log('SCHEMA DIFF REPORT');
console.log('════════════════════════════════════════════');

if (allDiffs.length === 0) {
  console.log('✔ Aucun écart détecté.');
} else {
  const byCategory = new Map<string, Diff[]>();
  for (const d of allDiffs) {
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category)!.push(d);
  }
  for (const [cat, diffs] of byCategory) {
    console.log(`\n── ${cat} (${diffs.length} écarts) ──`);
    for (const d of diffs) {
      console.log(`  ${d.issue}`);
    }
  }
  console.log(`\nTotal : ${allDiffs.length} écart(s)`);
}

// Derived props (attendu : 0 en base, N en JS — dette #14)
const derivedCount = jsDerived?.length ?? 0;
console.log(`\n── DERIVED PROPS (dette #14) ──`);
console.log(`  JS: ${derivedCount} propriétés dérivées`);
console.log(`  DB: 0 (volontairement non seedées — Sprint 3+)`);

await sql.end();
