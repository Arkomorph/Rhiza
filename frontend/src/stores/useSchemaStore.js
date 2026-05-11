// ─── Store Zustand — Schéma persistant (Décision O, Jalon 6) ─────────
// Source de vérité unique : GET /schema → Postgres.
// Fetch au démarrage de l'app, refetch après chaque mutation.
// Les dérivés (ontologyTree, ontologyFlat, edgeTypesFormatted) sont
// recalculés dans fetchAll() et stockés en state — pas des méthodes.

import { create } from 'zustand';
import { flattenOntology, findPathForType, getEffectiveProps } from '../helpers/ontology.js';

import { API_BASE } from '../config/api.js';

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

// Calcul de la hiérarchie spatiale depuis les expected_edges ContenuDans.
// Après le cleanup Mai 2026, tous les ContenuDans actifs sont hard.
// Un seul calcul childrenOf suffit (plus de distinction hard/soft).
// La chaîne canonique est calculée par marche linéaire via childrenOf.
function buildSpatialHierarchy(types, expectedEdges) {
  // childrenOf : pour chaque type parent, quels types sont "contenus dans" lui
  const childrenOf = {};
  for (const ee of expectedEdges) {
    if (ee.edge_key === 'ContenuDans' && ee.direction === 'outgoing') {
      if (!childrenOf[ee.target_type]) childrenOf[ee.target_type] = [];
      if (!childrenOf[ee.target_type].includes(ee.type_key)) {
        childrenOf[ee.target_type].push(ee.type_key);
      }
    }
  }
  // Types sans enfant → array vide
  for (const t of types) {
    if (!childrenOf[t.key]) childrenOf[t.key] = [];
  }

  // Alias : la racine UI "Suisse" représente la racine ontologique "Territoire"
  // pour les cascades "+". Canton a ContenuDans → Territoire, pas → Suisse.
  // Dette Sprint 3 : découpler proprement type/label de la racine.
  childrenOf['Suisse'] = childrenOf['Territoire'] || [];

  // Chaîne canonique par marche linéaire depuis Territoire via childrenOf
  const canonical = ['Suisse'];
  const visited = new Set(['Suisse']);

  function walk(parentKey) {
    const children = childrenOf[parentKey] || [];
    for (const child of children) {
      if (!visited.has(child)) {
        visited.add(child);
        canonical.push(child);
        walk(child);
      }
    }
  }

  walk('Territoire');
  if (canonical.length === 1) walk('Suisse');

  return { canonical, childrenOf };
}

function buildTypesByFamily(types) {
  const families = {};
  for (const t of types) {
    const root = t.parent_key === null ? t.key : null;
    if (root) {
      if (!families[root]) families[root] = [];
    }
  }
  for (const t of types) {
    // Trouver la racine en remontant parent_key
    let current = t;
    const typeMap = {};
    for (const tt of types) typeMap[tt.key] = tt;
    while (current.parent_key && typeMap[current.parent_key]) {
      current = typeMap[current.parent_key];
    }
    if (!families[current.key]) families[current.key] = [];
    if (t.key !== current.key) families[current.key].push(t.key);
  }
  return families;
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

  // Hiérarchie spatiale dérivée des expected_edges ContenuDans
  // Calculée dans fetchAll — remplace les constantes hardcodées CANONICAL, TYPES, CHILDREN_OF
  territoireCanonical: [],    // ["Suisse", "Canton", "Commune", "Secteur", ...] — ordre d'imbrication spatiale
  territoireChildrenOf: {},   // { "Suisse": ["Canton"], "Canton": ["Commune"], ... }
  territoireSubtypes: [],     // sous-types directs de Territoire (pour la légende)
  typesByFamily: {},          // { Territoire: [...], Acteur: [...], ... }

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

      // Hiérarchie spatiale dérivée des expected_edges ContenuDans
      const spatial = buildSpatialHierarchy(data.types, data.expected_edges);
      const subtypes = data.types
        .filter(t => t.parent_key === 'Territoire' && !t.archived_at)
        .map(t => t.key);
      const families = buildTypesByFamily(data.types);

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
        territoireCanonical: spatial.canonical,
        territoireChildrenOf: spatial.childrenOf,
        territoireSubtypes: subtypes,
        typesByFamily: families,
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

  // Retourne la famille racine d'un type (ex: "Bâtiment" → "Territoire")
  getTypeFamily: (type) => {
    const { typesByFamily } = get();
    for (const [family, types] of Object.entries(typesByFamily)) {
      if (types.some(t => t.key === type)) return family;
    }
    return type; // fallback : le type est sa propre famille
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
