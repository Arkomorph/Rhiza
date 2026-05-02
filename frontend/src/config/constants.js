// ─── Constantes structurelles ────────────────────────────────────────

// Sous-types Territoire — chaîne canonique
export const TYPES = ["Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce"];

// Imbrication stricte
export const CHILDREN_OF = {
  "Suisse": ["Canton"],
  "Canton": ["Commune"],
  "Commune": ["Quartier"],
  "Quartier": ["Parcelle"],
  "Parcelle": ["Bâtiment"],
  "Bâtiment": ["Logement"],
  "Logement": ["Pièce"],
  "Pièce": [],
};

// Nœud racine permanent
export const ROOT = { id: "suisse", nom: "Suisse", type: "Suisse", status: "active", permanent: true };

// Indentation de l'arbre — chaque niveau décale de 20px
export const INDENT = 20;
// Alignement pastille cascade = INDENT + trait(16) + gap(8) + demi-pastille(5) - demi-pastille(4)
export const CASCADE_OFFSET = 45;

// Groupes ontologiques pour les sélecteurs
export const ONTOLOGY_GROUPS = [
  { label: "Territoire", types: ["Canton", "Commune", "Quartier", "Parcelle", "Bâtiment", "Logement", "Pièce"] },
  { label: "Acteur", types: ["Acteur"] },
  { label: "Flux", types: ["Flux"] },
  { label: "Décision", types: ["Décision"] },
];
export const ONTOLOGY_TYPES = ONTOLOGY_GROUPS.flatMap(g => g.types);
