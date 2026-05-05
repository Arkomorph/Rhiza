// ─── Store Zustand — Sources de données (Jalon 8a) ───────────────────
// Pattern identique à useSchemaStore et useTerritoiresStore.
// Fetch au démarrage de l'app, en parallèle des autres stores.

import { create } from 'zustand';

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.rhiza.ch';

// Calcule le prochain ID disponible (format S001, S002, ..., S1000)
function computeNextId(sources) {
  let max = 0;
  for (const s of sources) {
    const m = s.id?.match(/^S(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `S${String(next).padStart(3, '0')}`;
}

// Groupe les sources par target_type
function groupByTargetType(sources) {
  const grouped = {};
  const uncategorized = [];
  for (const s of sources) {
    if (s.target_type) {
      if (!grouped[s.target_type]) grouped[s.target_type] = [];
      grouped[s.target_type].push(s);
    } else {
      uncategorized.push(s);
    }
  }
  return { grouped, uncategorized };
}

const useSourcesStore = create((set, get) => ({
  sources: [],
  loading: true,
  error: null,

  // Dérivés calculés dans fetchAll, stockés en state
  sourcesByTargetType: {},
  sourcesUncategorized: [],
  nextId: 'S001',

  fetchAll: async () => {
    try {
      set({ loading: true, error: null });
      const r = await fetch(`${API_BASE}/sources`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const sources = data.sources || [];

      const { grouped, uncategorized } = groupByTargetType(sources);
      const nextId = computeNextId(sources);

      set({
        sources,
        sourcesByTargetType: grouped,
        sourcesUncategorized: uncategorized,
        nextId,
        loading: false,
      });
    } catch (err) {
      console.error('[sources] fetch failed', err);
      set({ loading: false, error: 'Impossible de charger les sources' });
    }
  },

  addSource: async (body) => {
    const r = await fetch(`${API_BASE}/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    await get().fetchAll();
    return await r.json();
  },

  updateSource: async (id, body) => {
    const r = await fetch(`${API_BASE}/sources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await get().fetchAll();
  },

  deleteSource: async (id) => {
    const r = await fetch(`${API_BASE}/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await get().fetchAll();
  },
}));

export default useSourcesStore;
