// ─── Store Zustand — Territoires (même pattern que useSchemaStore) ────
// Source de vérité : GET /territoires → Postgres + Neo4j.
// Fetch au démarrage de l'app, en parallèle du fetch Schéma.

import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

const useTerritoiresStore = create((set, get) => ({
  // Raw API data
  territoires: [],

  // Dérivés (calculés dans fetchAll, stockés en state)
  // nodes = format attendu par TreeNode (id, nom, type, status, parentId, etc.)
  nodes: [],
  // index par UUID pour lookups rapides
  byUuid: {},

  loading: true,
  error: null,

  // ── Fetch ──────────────────────────────────────────────────────────

  fetchAll: async () => {
    try {
      set({ loading: true, error: null });
      const r = await fetch(`${API_BASE}/territoires`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const list = data.territoires || [];

      // Convertir au format TreeNode
      // nature_history "Territoire:Quartier:" → "Quartier"
      const nodes = list.map(t => {
        const parts = (t.nature_history || '').split(':').filter(Boolean);
        // nature_history "Territoire:" → type "Suisse" (racine), "Territoire:Canton:" → "Canton"
        const type = parts.length === 1 ? 'Suisse' : (parts[1] || 'Territoire');
        const isRoot = t.parent_uuid === null;
        return {
          id: t.uuid,
          nom: t.nom,
          type,
          status: isRoot ? 'active' : 'draft',
          permanent: isRoot,
          placeholder: false,
          sources: [],
          // Suisse a parent_uuid=null → pas de parentId (racine de l'arbre)
          parentId: t.parent_uuid || null,
        };
      });

      const byUuid = {};
      for (const n of nodes) byUuid[n.id] = n;

      set({ territoires: list, nodes, byUuid, loading: false });
    } catch (err) {
      console.error('[territoires] fetch failed', err);
      set({ loading: false, error: 'Impossible de charger les territoires' });
    }
  },

  // ── Mutations ──────────────────────────────────────────────────────

  addTerritoire: async (body) => {
    const r = await fetch(`${API_BASE}/territoires`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`);
    const result = await r.json();
    await get().fetchAll();
    return result;
  },

  // Stubs Sprint 2 — pas de PATCH/DELETE encore
  updateTerritoire: async () => { throw new Error('PATCH /territoires non implémenté Sprint 2'); },
  deleteTerritoire: async () => { throw new Error('DELETE /territoires non implémenté Sprint 2'); },
}));

export default useTerritoiresStore;
