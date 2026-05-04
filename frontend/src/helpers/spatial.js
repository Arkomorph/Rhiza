// ─── Helpers spatiaux et familles de types ───────────────────────────
// Fonctions pures — pas de dépendance au store Zustand.
// Les composants récupèrent edgeTypes depuis le store et les passent en argument.

export const TYPE_FAMILY = (t) => {
  if (["Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce", "Suisse"].includes(t)) return "Territoire";
  return t;
};

// Chaîne canonique d'imbrication territoriale (Bâtiment toujours dans Parcelle, etc.)
export const CANONICAL = ["Suisse", "Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce"];

export function getIntermediaryTypes(parentType, targetType) {
  const pi = CANONICAL.indexOf(parentType);
  const ti = CANONICAL.indexOf(targetType);
  if (pi === -1 || ti === -1 || ti <= pi + 1) return [];
  return CANONICAL.slice(pi + 1, ti);
}

// edgeTypes passé en argument — plus d'import statique
export const compatibleEdges = (famA, famB, edgeTypes = []) =>
  edgeTypes.filter(e =>
    (e.from === famA && e.to === famB) ||
    (e.from === famB && e.to === famA)
  );
