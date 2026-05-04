// ─── Seed Schema — Jalon 5 Sprint 2 ─────────────────────────────────
// Peuple les 6 tables config.schema_* depuis les constantes JS frontend.
// One-shot : abort si des données existent déjà.
//
// Usage : cd ~/Rhiza/backend && npx tsx src/scripts/seed-schema.ts
//   ou via docker run (même pattern que seed-musy.ts)

import sql from '../db/postgres.js';
import { migrate } from '../db/migrate.js';

// ─── Données source (extraites de frontend/src/data/) ────────────────

// 4 types racines + 18 sous-types = 22 types
const TYPES: Array<{ key: string; label: string; parent_key: string | null; description: string | null; is_locked: boolean }> = [
  // Racines verrouillées
  { key: "Territoire", label: "Territoire", parent_key: null, description: "Entité spatiale ancrée dans le sol. Géométrie, EGID potentiel, coordonnées.", is_locked: true },
  { key: "Acteur", label: "Acteur", parent_key: null, description: "Entité qui détient du pouvoir ou subit des effets dans une chaîne causale.", is_locked: true },
  { key: "Flux", label: "Flux", parent_key: null, description: "Mouvement matériel ou immatériel qui précède et conditionne une relation entre deux nœuds.", is_locked: true },
  { key: "Decision", label: "Décision", parent_key: null, description: "Opérateur de changement topologique intentionnel dans la réalité humaine du territoire.", is_locked: true },
  // Sous-types Territoire
  { key: "Canton", label: "Canton", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Commune", label: "Commune", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Quartier", label: "Quartier", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Parcelle", label: "Parcelle", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Batiment", label: "Bâtiment", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Logement", label: "Logement", parent_key: "Territoire", description: null, is_locked: false },
  { key: "Piece", label: "Pièce", parent_key: "Territoire", description: null, is_locked: false },
  // Sous-types Acteur
  { key: "Humain", label: "Humain", parent_key: "Acteur", description: null, is_locked: false },
  { key: "Nature", label: "Nature", parent_key: "Acteur", description: null, is_locked: false },
  { key: "Individu", label: "Individu", parent_key: "Humain", description: null, is_locked: false },
  { key: "Groupe", label: "Groupe", parent_key: "Humain", description: null, is_locked: false },
  { key: "Menage", label: "Ménage", parent_key: "Groupe", description: null, is_locked: false },
  { key: "Indivision", label: "Indivision", parent_key: "Groupe", description: null, is_locked: false },
  { key: "Personne_morale", label: "Personne morale", parent_key: "Groupe", description: null, is_locked: false },
  { key: "Droit_prive", label: "Droit privé", parent_key: "Personne_morale", description: null, is_locked: false },
  { key: "Droit_public", label: "Droit public", parent_key: "Personne_morale", description: null, is_locked: false },
  { key: "Collectif_informel", label: "Collectif informel", parent_key: "Groupe", description: null, is_locked: false },
  // Sous-types Nature
  { key: "Individu_vivant", label: "Individu vivant", parent_key: "Nature", description: null, is_locked: false },
  { key: "Population", label: "Population", parent_key: "Nature", description: null, is_locked: false },
  { key: "Ecosysteme", label: "Écosystème", parent_key: "Nature", description: null, is_locked: false },
];

// 9 arêtes
const EDGES: Array<{ key: string; label: string; from_type: string; to_type: string; description: string }> = [
  { key: "Possede", label: "Possède", from_type: "Acteur", to_type: "Territoire", description: "Régime foncier (PPE, locatif, coopératif, institutionnel, droit de superficie)" },
  { key: "HabiteUtilise", label: "Habite/utilise", from_type: "Acteur", to_type: "Territoire", description: "Occupation effective avec profil d'usage" },
  { key: "DecideSur", label: "Décide sur", from_type: "Acteur", to_type: "Decision", description: "Pouvoir formel ou informel sur une Décision" },
  { key: "FinanceRecoit", label: "Finance/reçoit", from_type: "Acteur", to_type: "Acteur", description: "Flux financier (subvention, prêt, achat, donation, taxe)" },
  { key: "Traverse", label: "Traverse", from_type: "Flux", to_type: "Territoire", description: "Flux de ressources (énergie, eau, mobilité, matière)" },
  { key: "Impacte", label: "Impacte", from_type: "Decision", to_type: "Territoire", description: "Application directe d'une décision sur un territoire ou acteur" },
  { key: "SoumetA", label: "Soumet à", from_type: "Decision", to_type: "Acteur", description: "Procédure administrative formellement adressée à un acteur institutionnel" },
  { key: "Engage", label: "Engage", from_type: "Decision", to_type: "Decision", description: "Causalité procédurale — une décision qui en enclenche une autre" },
  { key: "ContenuDans", label: "Contenu dans", from_type: "Territoire", to_type: "Territoire", description: "Hiérarchie spatiale ou administrative" },
];

// Propriétés spécifiques par arête (23 propriétés)
interface EdgeProp { edge_key: string; key: string; label: string; data_type: string; required: boolean; enum_values: string[] | null; notes: string | null }
const EDGE_PROPS: EdgeProp[] = [
  { edge_key: "Possede", key: "regime", label: "Régime", data_type: "enum", required: true, enum_values: ["PPE", "locatif", "cooperatif", "institutionnel", "droit_de_superficie"], notes: null },
  { edge_key: "Possede", key: "part", label: "Part (%)", data_type: "float", required: false, enum_values: null, notes: null },
  { edge_key: "HabiteUtilise", key: "regime_tenure", label: "Régime de tenure", data_type: "enum", required: false, enum_values: ["proprietaire", "locataire", "sous_locataire", "droit_usage"], notes: null },
  { edge_key: "HabiteUtilise", key: "loyer_mensuel", label: "Loyer mensuel", data_type: "float", required: false, enum_values: null, notes: null },
  { edge_key: "HabiteUtilise", key: "duree_occupation", label: "Durée d'occupation", data_type: "string", required: false, enum_values: null, notes: null },
  { edge_key: "HabiteUtilise", key: "profil_usage", label: "Profil d'usage", data_type: "enum", required: false, enum_values: ["residentiel", "commercial", "mixte", "temporaire"], notes: null },
  { edge_key: "DecideSur", key: "nature_pouvoir", label: "Nature du pouvoir", data_type: "enum", required: false, enum_values: ["formel", "informel", "delegue", "consultatif"], notes: null },
  { edge_key: "DecideSur", key: "role", label: "Rôle", data_type: "string", required: false, enum_values: null, notes: null },
  { edge_key: "FinanceRecoit", key: "montant", label: "Montant", data_type: "float", required: false, enum_values: null, notes: null },
  { edge_key: "FinanceRecoit", key: "unite", label: "Unité", data_type: "string", required: false, enum_values: null, notes: "CHF par défaut" },
  { edge_key: "FinanceRecoit", key: "frequence", label: "Fréquence", data_type: "enum", required: false, enum_values: ["unique", "mensuel", "annuel", "recurrent"], notes: null },
  { edge_key: "FinanceRecoit", key: "nature", label: "Nature", data_type: "enum", required: false, enum_values: ["subvention", "pret", "achat", "donation", "taxe"], notes: null },
  { edge_key: "Traverse", key: "quantite", label: "Quantité", data_type: "float", required: false, enum_values: null, notes: null },
  { edge_key: "Traverse", key: "unite", label: "Unité", data_type: "string", required: false, enum_values: null, notes: null },
  { edge_key: "Traverse", key: "direction", label: "Direction", data_type: "enum", required: false, enum_values: ["entrant", "sortant", "bidirectionnel"], notes: null },
  { edge_key: "Traverse", key: "frequence", label: "Fréquence", data_type: "enum", required: false, enum_values: ["continu", "saisonnier", "ponctuel"], notes: null },
  { edge_key: "Impacte", key: "nature_impact", label: "Nature de l'impact", data_type: "string", required: false, enum_values: null, notes: null },
  { edge_key: "Impacte", key: "magnitude", label: "Magnitude", data_type: "enum", required: false, enum_values: ["faible", "moyen", "fort"], notes: null },
  { edge_key: "SoumetA", key: "procedure", label: "Procédure", data_type: "enum", required: false, enum_values: ["permis", "subvention", "recours", "inscription", "autre"], notes: null },
  { edge_key: "SoumetA", key: "delai_attendu", label: "Délai attendu", data_type: "string", required: false, enum_values: null, notes: null },
  { edge_key: "SoumetA", key: "statut", label: "Statut", data_type: "enum", required: false, enum_values: ["soumis", "en_cours", "accepte", "refuse", "sans_reponse"], notes: null },
  { edge_key: "Engage", key: "nature_engagement", label: "Nature", data_type: "enum", required: false, enum_values: ["declenche", "conditionnel", "suit_a", "implique"], notes: null },
  { edge_key: "ContenuDans", key: "nature_contenance", label: "Nature", data_type: "enum", required: false, enum_values: ["administratif", "physique", "juridique", "ecologique", "statistique"], notes: null },
];

// 6 propriétés universelles d'arête
const UNIVERSAL_EDGE_PROPS: Array<{ key: string; label: string; data_type: string; required: boolean; enum_values: string[] | null; notes: string | null }> = [
  { key: "source", label: "Source", data_type: "string", required: true, enum_values: null, notes: "Origine de l'information" },
  { key: "confidence", label: "Confiance", data_type: "enum", required: true, enum_values: ["high", "medium", "low", "inferred"], notes: null },
  { key: "date", label: "Date", data_type: "date", required: true, enum_values: null, notes: "Création ou dernière vérification" },
  { key: "valid_from", label: "Valide depuis", data_type: "datetime", required: false, enum_values: null, notes: "Début de validité bi-temporelle" },
  { key: "valid_to", label: "Valide jusqu'à", data_type: "datetime", required: false, enum_values: null, notes: "Fin de validité (NULL = courant)" },
  { key: "exec_id", label: "ID exécution", data_type: "string", required: false, enum_values: null, notes: "Identifiant de l'import source" },
];

// 9 expected edges
const EXPECTED_EDGES: Array<{ type_key: string; edge_key: string; direction: string; target_type: string; obligation: string; multiplicity: string; default_mode: string }> = [
  { type_key: "Parcelle", edge_key: "ContenuDans", direction: "outgoing", target_type: "Commune", obligation: "hard", multiplicity: "one", default_mode: "linkOrCreateGeneric" },
  { type_key: "Parcelle", edge_key: "Possede", direction: "incoming", target_type: "Acteur", obligation: "hard", multiplicity: "many", default_mode: "linkOrCreateField" },
  { type_key: "Batiment", edge_key: "ContenuDans", direction: "outgoing", target_type: "Parcelle", obligation: "hard", multiplicity: "one", default_mode: "linkOrCreateGeneric" },
  { type_key: "Batiment", edge_key: "ContenuDans", direction: "outgoing", target_type: "Quartier", obligation: "soft", multiplicity: "one", default_mode: "linkOrCreateField" },
  { type_key: "Batiment", edge_key: "HabiteUtilise", direction: "incoming", target_type: "Humain", obligation: "soft", multiplicity: "many", default_mode: "linkOrCreateGeneric" },
  { type_key: "Logement", edge_key: "ContenuDans", direction: "outgoing", target_type: "Batiment", obligation: "hard", multiplicity: "one", default_mode: "linkOrCreateGeneric" },
  { type_key: "Logement", edge_key: "HabiteUtilise", direction: "incoming", target_type: "Menage", obligation: "soft", multiplicity: "one", default_mode: "linkOrCreateGeneric" },
  { type_key: "Decision", edge_key: "DecideSur", direction: "incoming", target_type: "Acteur", obligation: "hard", multiplicity: "many", default_mode: "linkOrCreateField" },
  { type_key: "Decision", edge_key: "Impacte", direction: "outgoing", target_type: "Territoire", obligation: "soft", multiplicity: "many", default_mode: "linkOrCreateField" },
];

// Propriétés intrinsèques par type (63 propriétés — sélection des plus importantes)
interface Prop { type_key: string; key: string; label: string; data_type: string; required: boolean; natural_key: boolean; enum_values: string[] | null; geom_kind: string | null; notes: string | null }
const PROPERTIES: Prop[] = [
  // Territoire (hérité par tous les sous-types)
  { type_key: "Territoire", key: "nom", label: "Nom", data_type: "string", required: true, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Canton
  { type_key: "Canton", key: "code", label: "Code cantonal", data_type: "string", required: true, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Canton", key: "nom_officiel", label: "Nom officiel", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Canton", key: "limite", label: "Limite cantonale", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "polygon", notes: null },
  // Commune
  { type_key: "Commune", key: "ofs_id", label: "ID OFS", data_type: "string", required: true, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Commune", key: "nom_officiel", label: "Nom officiel", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Commune", key: "population", label: "Population", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Commune", key: "limite", label: "Limite communale", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "polygon", notes: null },
  // Quartier
  { type_key: "Quartier", key: "code_statistique", label: "Code statistique", data_type: "string", required: false, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Quartier", key: "limite", label: "Limite du quartier", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "polygon", notes: null },
  // Parcelle
  { type_key: "Parcelle", key: "egrid", label: "EGRID", data_type: "string", required: true, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Parcelle", key: "no_parcelle", label: "N° de parcelle", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Parcelle", key: "surface", label: "Surface (m²)", data_type: "float", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Parcelle", key: "empreinte", label: "Empreinte cadastrale", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "polygon", notes: null },
  // Bâtiment
  { type_key: "Batiment", key: "egid", label: "EGID", data_type: "string", required: true, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Batiment", key: "annee_construction", label: "Année construction", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Batiment", key: "nb_logements", label: "Nombre de logements", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Batiment", key: "surface_brute", label: "Surface brute (m²)", data_type: "float", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Batiment", key: "classe_energetique", label: "Classe énergétique CECB", data_type: "enum", required: false, natural_key: false, enum_values: ["A", "B", "C", "D", "E", "F", "G"], geom_kind: null, notes: null },
  { type_key: "Batiment", key: "epoque_construction", label: "Époque de construction", data_type: "enum", required: false, natural_key: false, enum_values: ["8011", "8012", "8013", "8014", "8015", "8016", "8017", "8018", "8019", "8020", "8021", "8022", "8023"], geom_kind: null, notes: "Codes OFS RegBL (gbaup)" },
  { type_key: "Batiment", key: "systeme_chauffage", label: "Système de chauffage", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Batiment", key: "position", label: "Position (point d'adresse)", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "point", notes: null },
  { type_key: "Batiment", key: "empreinte", label: "Empreinte au sol", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "polygon", notes: null },
  // Logement
  { type_key: "Logement", key: "ewid", label: "EWID", data_type: "string", required: true, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Logement", key: "nb_pieces", label: "Nombre de pièces", data_type: "float", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Logement", key: "surface", label: "Surface (m²)", data_type: "float", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Pièce
  { type_key: "Piece", key: "nom", label: "Nom", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Piece", key: "usage", label: "Usage", data_type: "enum", required: false, natural_key: false, enum_values: ["sejour", "chambre", "cuisine", "salle_de_bain", "wc", "rangement", "autre"], geom_kind: null, notes: null },
  // Acteur
  { type_key: "Acteur", key: "nom", label: "Nom", data_type: "string", required: true, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Acteur", key: "notes", label: "Notes", data_type: "text", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Humain
  { type_key: "Humain", key: "langue_principale", label: "Langue principale", data_type: "enum", required: false, natural_key: false, enum_values: ["fr", "de", "it", "rm", "autre"], geom_kind: null, notes: null },
  // Individu
  { type_key: "Individu", key: "tranche_age", label: "Tranche d'âge", data_type: "enum", required: false, natural_key: false, enum_values: ["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80-84", "85-89", "90-94", "95-99", "100+"], geom_kind: null, notes: "Quinquennal OFS" },
  { type_key: "Individu", key: "genre", label: "Genre", data_type: "enum", required: false, natural_key: false, enum_values: ["masculin", "feminin", "autre", "inconnu"], geom_kind: null, notes: null },
  { type_key: "Individu", key: "nationalite", label: "Nationalité", data_type: "enum", required: false, natural_key: false, enum_values: ["suisse", "etranger"], geom_kind: null, notes: null },
  // Groupe
  { type_key: "Groupe", key: "taille", label: "Taille", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Groupe", key: "date_constitution", label: "Date de constitution", data_type: "date", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Ménage
  { type_key: "Menage", key: "taille_menage", label: "Taille du ménage", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Menage", key: "composition", label: "Composition", data_type: "enum", required: false, natural_key: false, enum_values: ["individuel", "familial", "non_familial", "collectif"], geom_kind: null, notes: null },
  // Indivision
  { type_key: "Indivision", key: "mode_indivision", label: "Mode d'indivision", data_type: "enum", required: false, natural_key: false, enum_values: ["hoirie", "copropriete_ppe", "indivision_commerciale", "indivision_simple"], geom_kind: null, notes: null },
  // Personne_morale
  { type_key: "Personne_morale", key: "numero_ide", label: "Numéro IDE", data_type: "string", required: false, natural_key: true, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Personne_morale", key: "parapublique", label: "Parapublique", data_type: "enum", required: false, natural_key: false, enum_values: ["non", "partiel", "total"], geom_kind: null, notes: null },
  { type_key: "Personne_morale", key: "actif", label: "Actif", data_type: "boolean", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Droit_prive
  { type_key: "Droit_prive", key: "forme_juridique", label: "Forme juridique", data_type: "enum", required: false, natural_key: false, enum_values: ["sa", "sarl", "snc", "scm", "association", "fondation", "cooperative", "succursale", "individuelle"], geom_kind: null, notes: null },
  // Droit_public
  { type_key: "Droit_public", key: "forme_juridique", label: "Forme juridique", data_type: "enum", required: false, natural_key: false, enum_values: ["commune", "canton", "confederation", "corporation_droit_public", "etablissement_droit_public", "fondation_droit_public"], geom_kind: null, notes: null },
  { type_key: "Droit_public", key: "niveau_administratif", label: "Niveau administratif", data_type: "enum", required: false, natural_key: false, enum_values: ["communal", "cantonal", "federal", "intercommunal"], geom_kind: null, notes: null },
  { type_key: "Droit_public", key: "competence", label: "Compétence", data_type: "list", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Individu_vivant
  { type_key: "Individu_vivant", key: "espece", label: "Espèce", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Individu_vivant", key: "age_estime", label: "Âge estimé", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Individu_vivant", key: "protection", label: "Protection", data_type: "enum", required: false, natural_key: false, enum_values: ["remarquable", "protege", "inventorie", "non"], geom_kind: null, notes: null },
  { type_key: "Individu_vivant", key: "localisation_precise", label: "Localisation précise", data_type: "geometry", required: false, natural_key: false, enum_values: null, geom_kind: "point", notes: null },
  // Population
  { type_key: "Population", key: "espece_taxon", label: "Espèce/taxon", data_type: "string", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  { type_key: "Population", key: "effectif_estime", label: "Effectif estimé", data_type: "integer", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
  // Ecosysteme
  { type_key: "Ecosysteme", key: "type_ecosysteme", label: "Type d'écosystème", data_type: "enum", required: false, natural_key: false, enum_values: ["corridor", "cours_d_eau", "foret", "prairie", "biotope", "autre"], geom_kind: null, notes: null },
  { type_key: "Ecosysteme", key: "surface", label: "Surface", data_type: "float", required: false, natural_key: false, enum_values: null, geom_kind: null, notes: null },
];

// ─── Main ────────────────────────────────────────────────────────────

await migrate();

// Idempotence : abort si déjà peuplé
const [{ count }] = await sql`SELECT count(*)::int AS count FROM config.schema_types`;
if (count > 0) {
  console.log(`⚠ Schema déjà peuplé (${count} types). Abandon.`);
  await sql.end();
  process.exit(0);
}

console.log('Seed schema...');

// 1. Types (ordre = racines d'abord pour satisfaire la FK parent_key)
for (const t of TYPES) {
  await sql`
    INSERT INTO config.schema_types (key, label, parent_key, description, is_locked)
    VALUES (${t.key}, ${t.label}, ${t.parent_key}, ${t.description}, ${t.is_locked})
  `;
}
console.log(`  ✔ ${TYPES.length} types`);

// 2. Arêtes
for (const e of EDGES) {
  await sql`
    INSERT INTO config.schema_edges (key, label, from_type, to_type, description)
    VALUES (${e.key}, ${e.label}, ${e.from_type}, ${e.to_type}, ${e.description})
  `;
}
console.log(`  ✔ ${EDGES.length} arêtes`);

// 3. Propriétés par arête
for (const p of EDGE_PROPS) {
  await sql`
    INSERT INTO config.schema_edge_properties (edge_key, key, label, data_type, required, enum_values, notes)
    VALUES (${p.edge_key}, ${p.key}, ${p.label}, ${p.data_type}, ${p.required}, ${p.enum_values ? sql.json(p.enum_values) : null}, ${p.notes})
  `;
}
console.log(`  ✔ ${EDGE_PROPS.length} propriétés d'arête`);

// 4. Propriétés universelles d'arête
for (const p of UNIVERSAL_EDGE_PROPS) {
  await sql`
    INSERT INTO config.schema_universal_edge_properties (key, label, data_type, required, enum_values, notes)
    VALUES (${p.key}, ${p.label}, ${p.data_type}, ${p.required}, ${p.enum_values ? sql.json(p.enum_values) : null}, ${p.notes})
  `;
}
console.log(`  ✔ ${UNIVERSAL_EDGE_PROPS.length} propriétés universelles`);

// 5. Propriétés intrinsèques par type
for (const p of PROPERTIES) {
  await sql`
    INSERT INTO config.schema_properties (type_key, key, label, data_type, required, natural_key, enum_values, geom_kind, notes)
    VALUES (${p.type_key}, ${p.key}, ${p.label}, ${p.data_type}, ${p.required}, ${p.natural_key}, ${p.enum_values ? sql.json(p.enum_values) : null}, ${p.geom_kind}, ${p.notes})
  `;
}
console.log(`  ✔ ${PROPERTIES.length} propriétés intrinsèques`);

// 6. Expected edges
for (const e of EXPECTED_EDGES) {
  await sql`
    INSERT INTO config.schema_expected_edges (type_key, edge_key, direction, target_type, obligation, multiplicity, default_mode)
    VALUES (${e.type_key}, ${e.edge_key}, ${e.direction}, ${e.target_type}, ${e.obligation}, ${e.multiplicity}, ${e.default_mode})
  `;
}
console.log(`  ✔ ${EXPECTED_EDGES.length} arêtes attendues`);

console.log('\n✔ Seed schema terminé');
await sql.end();
