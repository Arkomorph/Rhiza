# Rhiza

Outil de lecture relationnelle du territoire urbain suisse, basé sur Neo4j.

## Démarrage rapide

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose

### Lancer Neo4j

```bash
docker compose up -d
```

Neo4j est accessible sur :
- **Browser** : http://localhost:7474
- **Bolt** : bolt://localhost:7687
- **Login** : `neo4j` / `${NEO4J_PASSWORD}`

### Charger le graphe

Dans le Neo4j Browser (http://localhost:7474), copier-coller le contenu de :

```
schema/musy_96.cypher
```

Ou via la ligne de commande :

```bash
cat schema/musy_96.cypher | docker exec -i rhiza-neo4j cypher-shell -u neo4j -p ${NEO4J_PASSWORD}
```

### Exécuter la requête « Paradoxe de Musy »

```bash
cat queries/paradoxe_musy.cypher | docker exec -i rhiza-neo4j cypher-shell -u neo4j -p ${NEO4J_PASSWORD}
```

Cette requête identifie les acteurs qui occupent un bâtiment affecté par une décision, sans avoir aucun lien vers cette décision.

## Ontologie

| Type de nœud | Exemples |
|---|---|
| Territoire | quartier, parcelle, bâtiment |
| Acteur | propriétaire, locataires, services publics |
| Flux | réseau gaz, réseau électrique |
| Décision | rénovation, permis, subvention |

Chaque relation porte 3 attributs obligatoires : `confidence`, `source`, `date`.

## Arrêter

```bash
docker compose down
```

Les données persistent dans le volume `neo4j_data`. Pour tout supprimer :

```bash
docker compose down -v
```
