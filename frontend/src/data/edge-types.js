// ─── Table de compatibilité matching spatial (Annexe 13) ────────────
// Quelles méthodes PostGIS sont valides pour quelle paire de géométries.
// Source = ce qu'on importe ; Cible = la propriété géométrique du nœud existant.
// Invariant technique (ST_Within entre 2 points n'a pas de sens) — reste en dur,
// pas dans la page paramètres.
// INITIAL_EDGE_TYPES supprimé — les arêtes vivent en base (config.schema_edges).

export const SPATIAL_OPS = {
  point: {
    point:      [{ key: "ST_DWithin",   label: "ST_DWithin (à proximité)",          needsTolerance: true }],
    linestring: [{ key: "ST_DWithin",   label: "ST_DWithin (à proximité d'une ligne)", needsTolerance: true }],
    polygon:    [
      { key: "ST_Within",     label: "ST_Within (point dans polygone)" },
      { key: "ST_Intersects", label: "ST_Intersects (chevauche)" },
    ],
  },
  linestring: {
    point:      [{ key: "ST_DWithin",   label: "ST_DWithin (à proximité)",          needsTolerance: true }],
    linestring: [
      { key: "ST_Intersects", label: "ST_Intersects (croise)" },
      { key: "ST_DWithin",    label: "ST_DWithin (à proximité)", needsTolerance: true },
    ],
    polygon:    [
      { key: "ST_Intersects", label: "ST_Intersects (traverse)" },
      { key: "ST_Within",     label: "ST_Within (entièrement dans)" },
    ],
  },
  polygon: {
    point:      [
      { key: "ST_Contains",   label: "ST_Contains (contient le point)" },
      { key: "ST_Intersects", label: "ST_Intersects (chevauche)" },
    ],
    linestring: [
      { key: "ST_Intersects", label: "ST_Intersects (croise la ligne)" },
      { key: "ST_Contains",   label: "ST_Contains (contient la ligne)" },
    ],
    polygon:    [
      { key: "ST_Intersects", label: "ST_Intersects (chevauche)" },
      { key: "ST_Within",     label: "ST_Within (contenu dans)" },
      { key: "ST_Contains",   label: "ST_Contains (contient)" },
      { key: "ST_Equals",     label: "ST_Equals (identique)" },
    ],
  },
};

export const compatibleSpatialOps = (sourceKind, targetKind) => {
  if (!sourceKind || !targetKind) return [];
  return SPATIAL_OPS[sourceKind]?.[targetKind] || [];
};
