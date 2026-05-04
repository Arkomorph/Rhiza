// ─── Helpers spatiaux et familles de types ───────────────────────────
// Fonctions pures — pas de dépendance au store Zustand ni de constantes hardcodées.
// Les composants récupèrent les données depuis le store et les passent en argument.

export const TYPE_FAMILY = (t) => {
  if (["Canton", "Commune", "Secteur", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce", "Suisse"].includes(t)) return "Territoire";
  return t;
};

// canonical et edgeTypes passés en argument — plus d'import statique
export function getIntermediaryTypes(parentType, targetType, canonical) {
  const pi = canonical.indexOf(parentType);
  const ti = canonical.indexOf(targetType);
  if (pi === -1 || ti === -1 || ti <= pi + 1) return [];
  return canonical.slice(pi + 1, ti);
}

export const compatibleEdges = (famA, famB, edgeTypes = []) =>
  edgeTypes.filter(e =>
    (e.from === famA && e.to === famB) ||
    (e.from === famB && e.to === famA)
  );
