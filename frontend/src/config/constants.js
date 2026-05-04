// ─── Constantes structurelles ────────────────────────────────────────
// Les hiérarchies de types (TYPES, CHILDREN_OF, CANONICAL, ONTOLOGY_GROUPS)
// ne sont plus ici — elles sont dérivées du Schéma en base via useSchemaStore.
// Seules restent les constantes de layout et le nœud racine.

// Nœud racine permanent
export const ROOT = { id: "suisse", nom: "Suisse", type: "Suisse", status: "active", permanent: true };

// Indentation de l'arbre — chaque niveau décale de 20px
export const INDENT = 20;
// Alignement pastille cascade = INDENT + trait(16) + gap(8) + demi-pastille(5) - demi-pastille(4)
export const CASCADE_OFFSET = 45;
