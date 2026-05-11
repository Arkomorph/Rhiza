// ─── Store Zustand — Logs unifiés (Jalon 6.5) ───────────────────────
// Polling GET /logs avec auth Bearer pour récupérer les logs backend.
// Merge avec le ring buffer frontend (logger.js) dans le composant.

import { create } from 'zustand';

import { API_BASE } from '../config/api.js';
const LOGS_TOKEN = import.meta.env.VITE_LOGS_TOKEN || '';

const useLogsStore = create((set, get) => ({
  backendLogs: [],
  polling: true,
  intervalMs: 5000,
  loading: false,
  error: null,

  // Dernier timestamp reçu pour le paramètre ?since=
  _lastTimestamp: null,
  _intervalId: null,

  fetchBackendLogs: async () => {
    const { _lastTimestamp } = get();
    const params = new URLSearchParams({ limit: '200' });
    if (_lastTimestamp) params.set('since', _lastTimestamp);

    try {
      set({ loading: true, error: null });
      const r = await fetch(`${API_BASE}/logs?${params}`, {
        headers: LOGS_TOKEN ? { Authorization: `Bearer ${LOGS_TOKEN}` } : {},
      });
      if (!r.ok) {
        if (r.status === 401) throw new Error('Token logs invalide');
        throw new Error(`HTTP ${r.status}`);
      }
      const data = await r.json();
      const entries = data.entries || [];

      if (entries.length > 0) {
        const lastTs = entries[entries.length - 1].timestamp;
        set(state => ({
          backendLogs: dedup([...state.backendLogs, ...entries]).slice(-1000),
          _lastTimestamp: lastTs,
          loading: false,
        }));
      } else {
        set({ loading: false });
      }
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },

  startPolling: () => {
    const { _intervalId, intervalMs, fetchBackendLogs } = get();
    if (_intervalId) return; // déjà actif

    // Fetch immédiat + intervalle
    fetchBackendLogs();
    const id = setInterval(() => get().fetchBackendLogs(), intervalMs);
    set({ _intervalId: id, polling: true });
  },

  stopPolling: () => {
    const { _intervalId } = get();
    if (_intervalId) {
      clearInterval(_intervalId);
      set({ _intervalId: null, polling: false });
    }
  },

  togglePolling: () => {
    const { polling } = get();
    if (polling) get().stopPolling();
    else get().startPolling();
  },

  clearBackendLogs: () => {
    set({ backendLogs: [], _lastTimestamp: null });
  },
}));

// Déduplique par timestamp + message + origin
function dedup(entries) {
  const seen = new Set();
  return entries.filter(e => {
    const key = `${e.timestamp}|${e.origin}|${e.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default useLogsStore;
