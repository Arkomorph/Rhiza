// ─── Helpers spatiaux et familles de types ───────────────────────────
import { INITIAL_EDGE_TYPES } from '../data/edge-types.js';

export const TYPE_FAMILY = (t) => {
  if (["Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce", "Suisse"].includes(t)) return "Territoire";
  return t;
};

// Alias rétrocompatible
export const EDGE_TYPES = INITIAL_EDGE_TYPES;

export const compatibleEdges = (famA, famB) =>
  EDGE_TYPES.filter(e =>
    (e.from === famA && e.to === famB) ||
    (e.from === famB && e.to === famA)
  );
