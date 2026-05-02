// Catalogue des sources de données et schéma des propriétés par type de nœud
export const CATALOG = [
  { id: "S031", nom: "Parcelles RF cantonal", format: "WFS", portail: "geo.fr.ch" },
  { id: "S057", nom: "RegBL — Bâtiments", format: "GeoJSON", portail: "opendata.swiss" },
  { id: "S080", nom: "RBCI — Bâtiments", format: "WFS", portail: "geo.fr.ch" },
  { id: "S033", nom: "Zones d'affectation", format: "WFS", portail: "geo.fr.ch" },
  { id: "S034", nom: "Plan d'aménagement", format: "WFS", portail: "geo.fr.ch" },
  { id: "S051", nom: "Corridors écologiques", format: "Shapefile", portail: "OFEV" },
  { id: "S086", nom: "Cadastre du bruit", format: "Shapefile", portail: "OFEV" },
  { id: "S093", nom: "Potentiel solaire", format: "GeoPackage", portail: "BFE" },
];

// ─── Schéma des propriétés par type de nœud (MOCK) ───────────────────
// PROVISOIRE : au parcours 5, cette liste viendra du Schéma dynamique.
// Ici on pose un set réaliste pour pouvoir avancer le parcours 2.
export const SCHEMA_PROPS = {
  // Territoire : sous-types
  Suisse: [],
  Canton: [
    { key: "code", label: "Code cantonal", type: "string", natural_key: true },
    { key: "nom_officiel", label: "Nom officiel", type: "string" },
    { key: "limite", label: "Limite cantonale", type: "geometry", geomKind: "polygon" },
  ],
  Commune: [
    { key: "ofs_id", label: "ID OFS", type: "string", natural_key: true },
    { key: "nom_officiel", label: "Nom officiel", type: "string" },
    { key: "population", label: "Population", type: "integer" },
    { key: "limite", label: "Limite communale", type: "geometry", geomKind: "polygon" },
  ],
  Quartier: [
    { key: "nom", label: "Nom", type: "string" },
    { key: "code_statistique", label: "Code statistique", type: "string", natural_key: true },
    { key: "limite", label: "Limite du quartier", type: "geometry", geomKind: "polygon" },
  ],
  Parcelle: [
    { key: "egrid", label: "EGRID", type: "string", natural_key: true },
    { key: "no_parcelle", label: "N° de parcelle", type: "string" },
    { key: "surface", label: "Surface (m²)", type: "float" },
    { key: "proprietaire_nom", label: "Propriétaire", type: "string" },
    { key: "regime", label: "Régime (PPE, loc., coop.)", type: "string" },
    { key: "empreinte", label: "Empreinte cadastrale", type: "geometry", geomKind: "polygon" },
  ],
  Bâtiment: [
    { key: "egid", label: "EGID", type: "string", natural_key: true },
    { key: "annee_construction", label: "Année construction", type: "integer" },
    { key: "nb_logements", label: "Nombre de logements", type: "integer" },
    { key: "surface_brute", label: "Surface brute (m²)", type: "float" },
    { key: "classe_energetique", label: "Classe énergétique CECB", type: "string" },
    { key: "systeme_chauffage", label: "Système de chauffage", type: "string" },
    { key: "position", label: "Position (point d'adresse)", type: "geometry", geomKind: "point" },
    { key: "empreinte", label: "Empreinte au sol", type: "geometry", geomKind: "polygon" },
  ],
  Logement: [
    { key: "ewid", label: "EWID", type: "string", natural_key: true },
    { key: "nb_pieces", label: "Nombre de pièces", type: "float" },
    { key: "surface", label: "Surface (m²)", type: "float" },
    { key: "loyer_mensuel", label: "Loyer mensuel", type: "float" },
  ],
  Pièce: [
    { key: "nom", label: "Nom", type: "string" },
    { key: "usage", label: "Usage", type: "string" },
  ],
  // Autres types d'ontologie
  Acteur: [
    { key: "nom", label: "Nom", type: "string", natural_key: true },
    { key: "type_acteur", label: "Type (personne, institution, assoc., entreprise)", type: "string" },
    { key: "adresse", label: "Adresse", type: "string" },
  ],
  Décision: [
    { key: "titre", label: "Titre", type: "string" },
    { key: "type_decision", label: "Type", type: "string" },
    { key: "date", label: "Date", type: "date" },
    { key: "statut", label: "Statut", type: "string" },
  ],
  Flux: [
    { key: "nom", label: "Nom", type: "string" },
    { key: "type_flux", label: "Type (énergie, mobilité, eau, écologie)", type: "string" },
    { key: "unite", label: "Unité", type: "string" },
  ],
};
