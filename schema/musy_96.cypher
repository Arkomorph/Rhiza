// ============================================================
// Rhiza — Cas Bâtiment 96, Musy, Schönberg
// Ontologie : Territoire, Acteur, Flux, Décision
// ============================================================

// --- Contraintes d'unicité ---
CREATE CONSTRAINT IF NOT EXISTS FOR (t:Territoire) REQUIRE t.nom IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (a:Acteur)     REQUIRE a.nom IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (f:Flux)       REQUIRE f.nom IS UNIQUE;
CREATE CONSTRAINT IF NOT EXISTS FOR (d:Decision)   REQUIRE d.nom IS UNIQUE;

// --- Nœuds Territoire ---
CREATE (schoenb:Territoire {nom: "Schönberg", type: "quartier"})
CREATE (musy:Territoire    {nom: "Musy", type: "sous-quartier"})
CREATE (parc:Territoire    {nom: "Parcelle xx", type: "parcelle"})
CREATE (bat96:Territoire   {nom: "Bâtiment 96", type: "bâtiment",
        usage: "collectif", num_rp: 1122, surface_sp_m2: 3216,
        habitants: 62, epoque: "1970-80"})

// --- Nœuds Acteur ---
CREATE (realstone:Acteur   {nom: "Realstone", type: "propriétaire institutionnel"})
CREATE (locataires:Acteur  {nom: "Locataires Bât. 96", type: "ménages", nombre: 32})
CREATE (sac:Acteur         {nom: "Service de l'Aménagement et des constructions",
        type: "service communal"})
CREATE (senergie:Acteur    {nom: "Service de l'Énergie", type: "service cantonal"})
CREATE (fourni:Acteur      {nom: "Fournisseur d'énergie", type: "fournisseur"})

// --- Nœud Flux ---
CREATE (gaz:Flux           {nom: "Réseau gaz", vecteur: "gaz naturel"})

// --- Nœuds Décision ---
CREATE (renov:Decision     {nom: "Rénovation énergétique", statut: "planifiée"})
CREATE (demande:Decision   {nom: "Demande de permis", statut: "soumise"})
CREATE (permis:Decision    {nom: "Octroi du permis", statut: "en attente"})
CREATE (subv:Decision      {nom: "Octroi de subventionner", statut: "en attente"})

// ============================================================
// Relations — chaque arête porte confidence, source, date
// ============================================================

// Hiérarchie territoriale : CONTENU_DANS
CREATE (musy)-[:CONTENU_DANS {
  confidence: "high", source: "Plan d'aménagement communal", date: "2024"
}]->(schoenb)

CREATE (parc)-[:CONTENU_DANS {
  confidence: "high", source: "Registre foncier", date: "2024"
}]->(musy)

CREATE (bat96)-[:CONTENU_DANS {
  confidence: "high", source: "Registre foncier", date: "2024"
}]->(parc)

// Propriété
CREATE (realstone)-[:POSSEDE {
  confidence: "high", source: "Registre foncier", date: "2024"
}]->(parc)

// Réseau
CREATE (gaz)-[:TRAVERSE {
  confidence: "medium", source: "Plan des réseaux communal", date: "2023"
}]->(bat96)

CREATE (fourni)-[:POSSEDE {
  confidence: "high", source: "Contrat de concession", date: "2023"
}]->(gaz)

// Occupation
CREATE (locataires)-[:HABITE_UTILISE {
  confidence: "high", source: "Régie Realstone", date: "2024"
}]->(bat96)

// Flux financiers
CREATE (locataires)-[:FINANCE_RECOIT {
  confidence: "high", source: "Contrats de bail",
  date: "2024", objet: "loyer"
}]->(realstone)

CREATE (locataires)-[:FINANCE_RECOIT {
  confidence: "medium", source: "Décomptes de charges",
  date: "2024", objet: "charges énergie"
}]->(fourni)

// Décisions et engagements
CREATE (realstone)-[:DECIDE_SUR {
  confidence: "high", source: "PV conseil d'administration Realstone",
  date: "2024"
}]->(renov)

CREATE (renov)-[:IMPACTE {
  confidence: "high", source: "Dossier de rénovation", date: "2024"
}]->(parc)

CREATE (renov)-[:ENGAGE {
  confidence: "high", source: "Procédure cantonale", date: "2024"
}]->(demande)

CREATE (demande)-[:SOUMET_A {
  confidence: "high", source: "Procédure communale", date: "2024"
}]->(sac)

CREATE (demande)-[:SOUMET_A {
  confidence: "high", source: "Procédure cantonale énergie", date: "2024"
}]->(senergie)

CREATE (sac)-[:DECIDE_SUR {
  confidence: "high", source: "Procédure de permis de construire", date: "2024"
}]->(permis)

CREATE (permis)-[:ENGAGE {
  confidence: "inferred", source: "Logique procédurale", date: "2024"
}]->(renov)

CREATE (senergie)-[:DECIDE_SUR {
  confidence: "high", source: "Programme cantonal de subventions", date: "2024"
}]->(subv)

CREATE (subv)-[:FINANCE_RECOIT {
  confidence: "inferred", source: "Programme de subventions énergie",
  date: "2024", objet: "subvention rénovation"
}]->(realstone);
