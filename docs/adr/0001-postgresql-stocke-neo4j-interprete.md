# ADR-001 — PostgreSQL stocke, Neo4j interprete

**Date** : avril 2026 (retroactif — decision formalisee le 22 avril, points Z et AA)
**Statut** : Accepte

## Contexte

Mars 2026 : le proto initial mettait tout dans Neo4j, y compris les proprietes intrinseques versionnees via des "noeuds Valeur" (un noeud par version de chaque propriete). Cette approche a derive — Neo4j devenait un systeme de stockage versionne, ce pour quoi il n'est pas concu. Performance degradee, complexite des requetes, modele illisible.

## Alternatives envisagees

- **A — Tout dans Neo4j sauf geo.** Noeuds Valeur pour le versionnement, PostGIS uniquement pour les geometries. Rejete : Neo4j n'est pas un systeme de stockage versionne.
- **B — Neo4j minimal + PostgreSQL factuel.** Neo4j = noeuds + relations uniquement. PostgreSQL = proprietes versionnees bi-temporelles, geometries, provenance. Pont via EGRID/UUID.
- **C — PostgreSQL source unique, Neo4j miroir.** Tout dans PostgreSQL, Neo4j reconstruit a la demande. Rejete : perd la valeur native du graphe pour les traversees et les requetes Cypher.

## Decision

**Option B retenue.** Repartition stricte :
- PostgreSQL/PostGIS : tables versionnees bi-temporelles, proprietes intrinseques, geometries, provenance comme colonnes (source, confidence, date, valid_from, valid_to)
- Neo4j : noeuds (identifiant partage + labels) et relations (confidence/source/date comme proprietes d'arete)
- Backend Node.js+Fastify : assemble les deux bases, expose une API unifiee

Les noeuds Valeur sont abandonnes.

## Consequences

- Chaque base fait ce pour quoi elle est concue — PostgreSQL stocke et versionne, Neo4j traverse et interprete
- Le Matching (enrichir vs creer) est le seul acte qui demande un jugement cote backend
- Multi-source natif : plusieurs lignes par entite/propriete dans PostgreSQL, une seule identite dans Neo4j
- Complexite deplacee dans le backend (jointure des deux bases) plutot que dans le modele de donnees
