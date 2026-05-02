// Définitions des 9 types d'arêtes de l'ontologie et table de compatibilité spatiale PostGIS
// Source de vérité initiale — sera copiée en state mutable au démarrage du composant App.
export const INITIAL_EDGE_TYPES = [
  {
    key: "Possede", label: "Possède", from: "Acteur", to: "Territoire",
    description: "Relation de propriété juridique entre un Acteur et un Territoire. Établie par acte notarié, registre foncier, succession.",
    specific_props: [
      { key: "regime", label: "Régime de propriété", type: "enum", enum_values: ["ppe", "locatif", "cooperatif", "institutionnel", "droit_de_superficie"], obligatoire: true, notes: "Statut juridique de la possession. PPE = Propriété par étages." },
      { key: "part", label: "Part de propriété (%)", type: "float", obligatoire: false, notes: "Pourcentage en cas d'indivision ou copropriété. 100 % par défaut pour propriété entière." },
    ],
  },
  {
    key: "HabiteUtilise", label: "Habite/utilise", from: "Acteur", to: "Territoire",
    description: "Relation d'occupation effective. L'Acteur utilise le Territoire — résidence, bail commercial, occupation gratuite.",
    specific_props: [
      { key: "regime_tenure", label: "Régime de tenure", type: "enum", enum_values: ["proprietaire", "locataire", "occupant_gratuit", "autre"], obligatoire: true, notes: "Discriminant majeur pour l'inférence MVR (D6)." },
      { key: "loyer_mensuel", label: "Loyer mensuel (CHF)", type: "float", obligatoire: false, notes: "Si applicable. Source : RF, déclaration. Discriminant proxy du revenu." },
      { key: "duree_occupation", label: "Durée d'occupation", type: "enum", enum_values: ["moins_1an", "1_5ans", "5_10ans", "10_20ans", "plus_20ans"], obligatoire: false, notes: "Discriminant racines vs mobilité dans l'inférence MVR." },
      { key: "profil_usage", label: "Profil d'usage", type: "string", obligatoire: false, notes: "Description libre — résidence principale, secondaire, bureau, atelier, etc." },
    ],
  },
  {
    key: "DecideSur", label: "Décide sur", from: "Acteur", to: "Décision",
    description: "Relation de pouvoir formel ou informel sur une Décision. L'Acteur a participé à la prise ou à la signature.",
    specific_props: [
      { key: "nature_pouvoir", label: "Nature du pouvoir", type: "enum", enum_values: ["formel", "informel", "consultatif", "decisionnaire"], obligatoire: true, notes: "Formel = signature légale. Décisionnaire = pouvoir final. Consultatif = avis sans poids juridique." },
      { key: "role", label: "Rôle dans la décision", type: "string", obligatoire: false, notes: "Ex : rapporteur, président, opposant, etc." },
    ],
  },
  {
    key: "FinanceRecoit", label: "Finance/reçoit", from: "Acteur", to: "Acteur",
    description: "Flux financier entre Acteurs ou vers un Territoire — subvention, prêt, achat, donation, taxe.",
    specific_props: [
      { key: "montant", label: "Montant", type: "float", obligatoire: true },
      { key: "unite", label: "Devise/Unité", type: "enum", enum_values: ["chf", "eur", "usd", "autre"], obligatoire: true },
      { key: "frequence", label: "Fréquence", type: "enum", enum_values: ["ponctuel", "mensuel", "trimestriel", "annuel", "autre"], obligatoire: false },
      { key: "nature", label: "Nature du flux", type: "enum", enum_values: ["subvention", "pret", "achat", "donation", "taxe", "loyer", "autre"], obligatoire: false },
    ],
  },
  {
    key: "Traverse", label: "Traverse", from: "Flux", to: "Territoire",
    description: "Un Flux (énergie, eau, mobilité) circule à travers un Territoire — entrée, sortie, ou flux interne.",
    specific_props: [
      { key: "quantite", label: "Quantité", type: "float", obligatoire: false },
      { key: "unite", label: "Unité", type: "enum", enum_values: ["kwh", "mwh", "m3", "kg", "tonnes", "personnes", "autre"], obligatoire: false, notes: "Unité de la quantité. kWh/MWh pour énergie, m³ pour eau, kg pour matière, etc." },
      { key: "direction", label: "Direction", type: "enum", enum_values: ["entrant", "sortant", "bidirectionnel", "interne"], obligatoire: true },
      { key: "frequence", label: "Fréquence", type: "enum", enum_values: ["continu", "ponctuel", "saisonnier", "autre"], obligatoire: false },
    ],
  },
  {
    key: "Impacte", label: "Impacte", from: "Décision", to: "Territoire",
    description: "Application directe et factuelle d'une Décision sur un Territoire ou un Acteur. Pas une interprétation diffuse — une application traçable.",
    specific_props: [
      { key: "nature_impact", label: "Nature de l'impact", type: "enum", enum_values: ["direct", "secondaire"], obligatoire: true, notes: "Direct = la Décision désigne explicitement la cible. Secondaire = effet en chaîne traçable." },
      { key: "magnitude", label: "Magnitude estimée", type: "enum", enum_values: ["faible", "moyenne", "forte"], obligatoire: false, notes: "Estimation qualitative. À utiliser avec parcimonie — généralement déductible du contenu de la Décision." },
    ],
  },
  {
    key: "SoumetA", label: "Soumet à", from: "Décision", to: "Acteur",
    description: "Une Décision adressée formellement à un Acteur institutionnel pour traitement — dépôt de dossier, demande de permis, recours.",
    specific_props: [
      { key: "procedure", label: "Type de procédure", type: "enum", enum_values: ["permis_construire", "demande_subvention", "recours", "consultation", "autre"], obligatoire: true },
      { key: "delai_attendu", label: "Délai attendu (jours)", type: "integer", obligatoire: false, notes: "Délai légal ou estimé. L'absence de réponse au-delà révèle un blocage administratif." },
      { key: "statut", label: "Statut de la procédure", type: "enum", enum_values: ["en_attente", "instruit", "accepte", "rejete", "abandonne"], obligatoire: false },
    ],
  },
  {
    key: "Engage", label: "Engage", from: "Décision", to: "Décision",
    description: "Causalité procédurale entre deux Décisions. La première déclenche, conditionne ou implique la seconde.",
    specific_props: [
      { key: "nature_engagement", label: "Nature de l'engagement", type: "enum", enum_values: ["declenche", "conditionnel", "suit_a", "implique"], obligatoire: true, notes: "Déclenche = causalité directe. Conditionnel = la 2e dépend du résultat de la 1ère. Suit_a = ordre temporel sans causalité. Implique = la 1ère rend la 2e obligatoire." },
    ],
  },
  {
    key: "ContenuDans", label: "Contenu dans", from: "Territoire", to: "Territoire",
    description: "Hiérarchie d'inclusion entre Territoires. Multiple et non-exclusive — un même Territoire peut être contenu dans plusieurs autres selon des logiques différentes.",
    specific_props: [
      { key: "nature_contenance", label: "Nature de la contenance", type: "enum", enum_values: ["administratif", "physique", "juridique", "ecologique", "statistique"], obligatoire: true, notes: "Administratif = hiérarchie communale/cantonale. Physique = imbrication géométrique stricte. Juridique = périmètre réglementaire. Écologique = corridor, biotope. Statistique = découpage OFS." },
    ],
  },
];

// ─── Table de compatibilité matching spatial (Annexe 13 § YY) ────────
// Quelles méthodes PostGIS sont valides pour quelle paire de géométries.
// Source = ce qu'on importe ; Cible = la propriété géométrique du nœud existant.
// Invariant technique (ST_Within entre 2 points n'a pas de sens) — reste en dur,
// pas dans la page paramètres.
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
