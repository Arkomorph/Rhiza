// ─── Helpers spatiaux ────────────────────────────────────────────────
// Fonctions pures — pas de dépendance au store Zustand.
// TYPE_FAMILY supprimé — utiliser useSchemaStore.getTypeFamily() à la place.

// Types intermédiaires entre parent et cible dans la chaîne canonique
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
