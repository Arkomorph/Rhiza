// ============================================================
// Paradoxe de Musy
// Quels acteurs occupent un bâtiment sur lequel une décision
// a été prise, sans qu'ils aient aucune arête vers cette décision ?
// ============================================================

MATCH (acteur:Acteur)-[:HABITE_UTILISE]->(bat:Territoire)<-[:IMPACTE]-(decision:Decision)

// Exclure les acteurs qui ont un lien quelconque vers la décision
WHERE NOT exists {
  (acteur)-->(decision)
}

RETURN acteur.nom       AS acteur_exclu,
       acteur.type      AS type_acteur,
       bat.nom          AS batiment_occupe,
       decision.nom     AS decision_subie,
       decision.statut  AS statut_decision
ORDER BY acteur.nom, decision.nom;
