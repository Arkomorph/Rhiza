// Catalogue mock des sources — fallback legacy pour les sources proto.
// Les sources réelles viennent de useSourcesStore (API).
// SCHEMA_PROPS supprimé — les propriétés vivent en base (config.schema_properties).
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
