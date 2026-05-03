# ADR-002 — Double representation des types et sous-types

**Date** : mai 2026 (retroactif — raffinement du 1er mai, futur D11)
**Statut** : Accepte
**Raffine** : ADR-001

## Contexte

ADR-001 dit "Neo4j ne stocke que noeuds + relations". Mais les noeuds Neo4j portent des labels, et les labels sont une forme de stockage. Question : la hierarchie ontologique complete (ex: `Acteur > Humain > Personne_morale > Droit_public > Communal`) vit-elle dans les labels Neo4j ou dans PostgreSQL ?

## Decision

**Double representation** :

- **Types principaux -> labels Neo4j.** Les quatre types fondamentaux (`:Territoire`, `:Acteur`, `:Flux`, `:Decision`) restent des labels. Structurels — un Acteur ne devient jamais un Territoire. Multi-labels autorises (un arbre remarquable peut etre `:Territoire` et `:Acteur`). Servent au filtrage rapide via index natifs et aux metriques de centralite.

- **Sous-types -> propriete versionnee bi-temporelle dans PostgreSQL.** La hierarchie a l'interieur d'un type principal vit comme `nature_history` dans PostgreSQL, avec source, confidence, date, valid_from, valid_to. Meme logique que `loyer_mensuel` ou `classe_energetique`.

- **Synchronisation transactionnelle.** Changement de nature = deux operations dans la meme transaction : mutation des labels Neo4j (`SET`/`REMOVE`) + insertion dans la table versionnee. Labels = present. Propriete = historique.

## Benefices

- Diagnostic d'incoherence ontologique : Cypher detecte les noeuds avec proprietes incompatibles avec leur nature courante
- Nature a niveau intermediaire : un noeud peut etre `Personne_morale` sans savoir si `Droit_prive` ou `Droit_public` (confidence = medium, remonte comme "a raffiner")
- Evolutions tracables : cooperative -> SA, corrections de classement, renommages d'ontologie, scissions de sous-types

## Cas exigeant — coherence en cascade

Quand `Cooperative` -> `SA`, la propriete `forme_juridique` doit aussi changer dans la meme transaction. Quand `Droit_prive` -> `Droit_public`, la propriete `niveau_administratif` (propre a `Droit_public`) doit etre renseignee. Logique de cascade a instrumenter cote backend.

## Convergence avec D9

Un changement de nature detecte a l'import WFS devient un noeud `:Decision` automatique avec sa propre tracabilite (source = import, confidence = inferred).

## Alternatives ecartees

- **Labels seuls** : force la precision maximale, pas de nature intermediaire, pas d'historique, pas de diagnostic
- **PostgreSQL seul** : perd le filtrage rapide Neo4j par labels et les metriques de centralite typees
