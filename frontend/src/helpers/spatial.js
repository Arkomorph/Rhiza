// ─── Helpers spatiaux et familles de types ───────────────────────────
import { INITIAL_EDGE_TYPES } from '../data/edge-types.js';

export const TYPE_FAMILY = (t) => {
  if (["Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce", "Suisse"].includes(t)) return "Territoire";
  return t;
};

// Alias rétrocompatible
export const EDGE_TYPES = INITIAL_EDGE_TYPES;

// Chaîne canonique d'imbrication territoriale (Bâtiment toujours dans Parcelle, etc.)
export const CANONICAL = ["Suisse", "Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce"];

export function getIntermediaryTypes(parentType, targetType) {
  const pi = CANONICAL.indexOf(parentType);
  const ti = CANONICAL.indexOf(targetType);
  if (pi === -1 || ti === -1 || ti <= pi + 1) return [];
  return CANONICAL.slice(pi + 1, ti);
}

export const compatibleEdges = (famA, famB) =>
  EDGE_TYPES.filter(e =>
    (e.from === famA && e.to === famB) ||
    (e.from === famB && e.to === famA)
  );
