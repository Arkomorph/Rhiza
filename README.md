# Rhiza

Outil de lecture relationnelle du territoire urbain suisse, basé sur Neo4j.

## Démarrage rapide

### Prérequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose

### Configuration

```bash
cp .env.example .env
# Éditer .env avec de vrais mots de passe
```

### Lancer les services

```bash
docker compose up -d
```

### Accès Neo4j (via SSH tunnel sur le VPS)

```bash
ssh -L 7474:localhost:7474 -L 7687:localhost:7687 rhiza@api.rhiza.ch
```

Puis ouvrir http://localhost:7474

### Charger le graphe

```bash
docker exec -i rhiza-neo4j cypher-shell \
  -u neo4j -p "$(grep NEO4J_PASSWORD .env | cut -d= -f2)" \
  < schema/musy_96.cypher
```

## Ontologie (4 noeuds, 9 relations)

| Type de noeud | Exemples |
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

Les données persistent dans les volumes Docker. Pour tout supprimer :

```bash
docker compose down -v
```
