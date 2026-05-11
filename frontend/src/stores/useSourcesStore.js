// ─── Store Zustand — Sources de données (Jalon 8a) ───────────────────
// Pattern identique à useSchemaStore et useTerritoiresStore.
// Fetch au démarrage de l'app, en parallèle des autres stores.

import { create } from 'zustand';

import { API_BASE } from '../config/api.js';

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

      // Pour nextId, on doit connaître TOUS les IDs (y compris archivés)
      // pour ne jamais réutiliser un ID archivé (confusion audit trail)
      const rAll = await fetch(`${API_BASE}/sources?include_archived=true`);
      const allData = rAll.ok ? await rAll.json() : data;
      const allSources = allData.sources || sources;

      const { grouped, uncategorized } = groupByTargetType(sources);
      const nextId = computeNextId(allSources);

      console.log(`[sources] fetchAll: ${sources.length} actives, nextId=${nextId}`);
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

  executeSource: async (id, file, mapping) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    const r = await fetch(`${API_BASE}/sources/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
      body: formData,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    await get().fetchAll();
    return data;
  },

  deleteSource: async (id) => {
    console.log(`[sources] deleteSource ${id}...`);
    const r = await fetch(`${API_BASE}/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    console.log(`[sources] DELETE ${id} ok, refetching...`);
    await get().fetchAll();
    console.log(`[sources] refetch done, sources count: ${get().sources.length}`);
  },
}));

export default useSourcesStore;
