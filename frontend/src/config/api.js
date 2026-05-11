// ─── Configuration API ───────────────────────────────────────────────
// Source unique pour l'URL de l'API backend.
// En dev : VITE_API_URL=http://localhost:3000 dans .env
// En prod : fallback https://api.rhiza.ch

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
