// ─── Store Zustand — Schéma persistant (Décision O, Jalon 6) ─────────
// Source de vérité unique : GET /schema → Postgres.
// Fetch au démarrage de l'app, refetch après chaque mutation.
// Les dérivés (ontologyTree, ontologyFlat, edgeTypesFormatted) sont
// recalculés dans fetchAll() et stockés en state — pas des méthodes.

import { create } from 'zustand';
import { flattenOntology, findPathForType, getEffectiveProps } from '../helpers/ontology.js';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

// ─── Reconstruction de l'arbre depuis les données plates ─────────────

function buildOntologyTree(types, properties, expectedEdges) {
  // Index des propriétés et expected edges par type_key
  const propsByType = {};
  for (const p of properties) {
    if (!propsByType[p.type_key]) propsByType[p.type_key] = [];
    propsByType[p.type_key].push({
      key: p.key,
      label: p.label,
      type: p.data_type,
      natural_key: p.natural_key,
      enum_values: p.enum_values,
      geomKind: p.geom_kind,
      notes: p.notes,
      _id: p.id, // UUID pour les mutations PATCH/DELETE
    });
  }

  const eeByType = {};
  for (const ee of expectedEdges) {
    if (!eeByType[ee.type_key]) eeByType[ee.type_key] = [];
    eeByType[ee.type_key].push({
      edgeKey: ee.edge_key,
      direction: ee.direction,
      otherSide: [ee.target_type], // Simplifié — chemin complet reconstruit si besoin
      obligation: ee.obligation,
      multiplicity: ee.multiplicity,
      defaultMode: ee.default_mode,
      _id: ee.id, // UUID pour les mutations
    });
  }

  // Construire l'arbre récursivement
  const typesByParent = {};
  const typeMap = {};
  for (const t of types) {
    typeMap[t.key] = t;
    const parent = t.parent_key || '__root__';
    if (!typesByParent[parent]) typesByParent[parent] = [];
    typesByParent[parent].push(t);
  }

  function buildNode(t) {
    const children = typesByParent[t.key] || [];
    const childrenObj = {};
    for (const c of children) {
      childrenObj[c.key] = buildNode(c);
    }
    return {
      key: t.key,
      label: t.label,
      description: t.description,
      is_locked: t.is_locked,
      props: propsByType[t.key] || [],
      expectedEdges: eeByType[t.key] || [],
      ...(Object.keys(childrenObj).length > 0 ? { children: childrenObj } : {}),
    };
  }

  const roots = typesByParent['__root__'] || [];
  const tree = {};
  for (const r of roots) {
    tree[r.key] = buildNode(r);
  }
  return tree;
}

function buildEdgeTypesFormatted(edges, edgeProperties) {
  const propsByEdge = {};
  for (const p of edgeProperties) {
    if (!propsByEdge[p.edge_key]) propsByEdge[p.edge_key] = [];
    propsByEdge[p.edge_key].push({
      key: p.key,
      label: p.label,
      type: p.data_type,
      obligatoire: p.required,
      enum_values: p.enum_values,
      notes: p.notes,
      _id: p.id,
    });
  }
  return edges.map(e => ({
    key: e.key,
    label: e.label,
    from: e.from_type,
    to: e.to_type,
    description: e.description,
    is_locked: e.is_locked,
    specific_props: propsByEdge[e.key] || [],
  }));
}

function buildOntologyTypesGrouped(tree) {
  const groups = [];
  for (const [rootKey, rootNode] of Object.entries(tree)) {
    const types = [];
    const walk = (node, depth) => {
      types.push({ key: node.key, label: node.label, depth });
      if (node.children) {
        for (const child of Object.values(node.children)) walk(child, depth + 1);
      }
    };
    walk(rootNode, 0);
    groups.push({ label: rootKey, types });
  }
  return groups;
}

// ─── Store ───────────────────────────────────────────────────────────

const useSchemaStore = create((set, get) => ({
  // Raw data from API
  types: [],
  properties: [],
  edges: [],
  edgeProperties: [],
  universalEdgeProperties: [],
  expectedEdges: [],

  // Derived (computed in fetchAll, stored as state — Décision A ajustement)
  ontologyTree: {},
  ontologyFlat: {},
  ontologyTypesGrouped: [],
  edgeTypesFormatted: [],

  // Loading
  loading: true,
  error: null,

  // ── Fetch ──────────────────────────────────────────────────────────

  fetchAll: async () => {
    try {
      set({ loading: true, error: null });
      const r = await fetch(`${API_BASE}/schema`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const tree = buildOntologyTree(data.types, data.properties, data.expected_edges);
      const flat = flattenOntology(tree);
      const grouped = buildOntologyTypesGrouped(tree);
      const formatted = buildEdgeTypesFormatted(data.edges, data.edge_properties);

      set({
        types: data.types,
        properties: data.properties,
        edges: data.edges,
        edgeProperties: data.edge_properties,
        universalEdgeProperties: data.universal_edge_properties,
        expectedEdges: data.expected_edges,
        ontologyTree: tree,
        ontologyFlat: flat,
        ontologyTypesGrouped: grouped,
        edgeTypesFormatted: formatted,
        loading: false,
      });
    } catch (err) {
      console.error('[schema] fetch failed', err);
      set({ loading: false, error: 'Impossible de charger le schéma' });
    }
  },

  // ── Helper: refetch after mutation ─────────────────────────────────

  getSchemaPropsForType: (type) => {
    const { ontologyTree } = get();
    if (!type) return [];
    const path = findPathForType(ontologyTree, type);
    return path ? getEffectiveProps(ontologyTree, path) : [];
  },

  // ── Mutations — POST/PATCH/DELETE puis refetch ─────────────────────
  // Chaque mutation appelle l'API puis refetch global (pas d'optimiste Sprint 2).

  addSubtype: async (parentKey, data) => {
    const r = await fetch(`${API_BASE}/schema/types/${encodeURIComponent(parentKey)}/subtypes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  updateType: async (key, data) => {
    const r = await fetch(`${API_BASE}/schema/types/${encodeURIComponent(key)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  deleteType: async (key) => {
    const r = await fetch(`${API_BASE}/schema/types/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  addProperty: async (typeKey, data) => {
    const r = await fetch(`${API_BASE}/schema/types/${encodeURIComponent(typeKey)}/properties`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  updateProperty: async (uuid, data) => {
    const r = await fetch(`${API_BASE}/schema/properties/${uuid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  deleteProperty: async (uuid) => {
    const r = await fetch(`${API_BASE}/schema/properties/${uuid}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  addExpectedEdge: async (typeKey, data) => {
    const r = await fetch(`${API_BASE}/schema/types/${encodeURIComponent(typeKey)}/expected_edges`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  updateExpectedEdge: async (uuid, data) => {
    const r = await fetch(`${API_BASE}/schema/expected_edges/${uuid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  deleteExpectedEdge: async (uuid) => {
    const r = await fetch(`${API_BASE}/schema/expected_edges/${uuid}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  addEdgeProperty: async (edgeKey, data) => {
    const r = await fetch(`${API_BASE}/schema/edges/${encodeURIComponent(edgeKey)}/properties`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  updateEdgeProperty: async (uuid, data) => {
    const r = await fetch(`${API_BASE}/schema/edge_properties/${uuid}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },

  deleteEdgeProperty: async (uuid) => {
    const r = await fetch(`${API_BASE}/schema/edge_properties/${uuid}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    await get().fetchAll();
  },
}));

export default useSchemaStore;
