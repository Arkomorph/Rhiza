# Rhiza — Contexte projet

## En une phrase
Rendre lisibles les dynamiques territoriales comme système vivant, en révélant les relations
invisibles entre acteurs, flux et décisions qu'aucun acteur seul ne peut percevoir.

## Terrain zéro
Schönberg, Fribourg — 9 283 habitants, 21 sous-quartiers, ~100 nationalités, 68.8% locataires,
bâtiments 1955-1975, 7/80 sièges au parlement municipal pour ~25% de la population fribourgeoise.
Cas fondateur : paradoxe de la rénovation énergétique à Musy (bâtiments 96 et 97).

## Stack technique
- Base graphe : Neo4j Community (Cypher)
- Base géo : PostgreSQL + PostGIS (bi-temporal, WFS, EGRID/EGID)
- Backend : Node.js + TypeScript + Fastify
- Vue cartographique : MapLibre GL JS
- Vue graphe : Sigma.js v3
- Frontend : React + TypeScript + Zustand (currentTimestamp partagé)
- Infra : Fedora VPS Infomaniak + Docker Compose

## Ontologie — 4 nœuds, 9 relations

### Types de nœuds
- **Territoire** — entité spatiale (parcelle, bâtiment, quartier, corridor)
- **Acteur** — entité qui détient du pouvoir ou subit des effets
- **Flux** — entité avec opérateur propre, infrastructure propre, cycle de vie propre
- **Décision** — opérateur temporel, seul nœud qui produit un delta dans le graphe

### Types de relations
| Relation | Direction | Description |
|---|---|---|
| Possède | Acteur → Territoire | Régime foncier |
| Habite/utilise | Acteur → Territoire | Usage avec profil |
| Décide sur | Acteur → Décision | Pouvoir formel ou informel |
| Finance/reçoit | Acteur → Flux → Acteur/Territoire | Flux financier |
| Traverse | Flux → Territoire | Flux physique qui passe par un espace |
| Contenu dans | Territoire → Territoire | Hiérarchie spatiale |
| Impacte | Décision → Territoire/Acteur | Relation directe et traçable, pas interprétation diffuse |
| Engage | Décision → Décision | Causalité procédurale, seulement si l'absence est un enjeu |
| Soumet à | Décision → Acteur | Dépôt formel à un acteur institutionnel |

### Attributs obligatoires sur toute relation
```cypher
confidence: 'high' | 'medium' | 'low' | 'inferred'
source: string
date: date
```

### Règle KIS ontologie
On n'ajoute un type que si son absence empêche de modéliser un cas réel.
Les interprétations appartiennent aux requêtes, pas à l'ontologie.

## Système de comptes
Droits par territoire — pas par rôle global. 5 niveaux :
Super-Admin (Jo) > Admin bureau (associées) > Admin local > Contributeur > Lecteur

## Sprint actuel — Sprint 1
Encoder le cas bâtiment 96 (Musy) en Cypher local.
Valider l'ontologie sur une vraie base avant de monter le VPS.
Référence : schema/musy_96.cypher

## Conventions Cypher
- Labels en PascalCase : (:Territoire), (:Acteur), (:Flux), (:Decision)
- Relations en SCREAMING_SNAKE_CASE : [:POSSEDE], [:DECIDE_SUR]
- Toujours les 3 attributs obligatoires sur chaque relation
- Commentaires en français
- Un fichier par cas d'usage, nommé kebab-case

## Ce que Rhiza n'est pas
- Pas un SIG
- Pas un outil de collecte de données
- Pas un système déductif ou inductif — abductif
