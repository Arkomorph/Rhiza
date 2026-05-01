# Rhiza — Infrastructure déployée

> Dernière mise à jour : 2026-04-16

## VPS

- **Hébergeur** : Infomaniak
- **OS** : Ubuntu 24.04 LTS
- **Ressources** : 4 vCPU, 8 Go RAM, 160 Go NVMe
- **IP** : 89.47.51.119 / 2001:1600:13:101::1ae9
- **Domaine** : api.rhiza.ch (DNS A + AAAA, TTL 5 min)
- **User** : rhiza (sudo, clé SSH, pas de login root ni mot de passe)

## Services Docker Compose

| Service | Image | Port | Accès |
|---------|-------|------|-------|
| Neo4j 5 Community + APOC | neo4j:5-community | 7474, 7687 | SSH tunnel uniquement |
| PostGIS 16 | postgis/postgis:16-3.4 | 5432 | SSH tunnel uniquement |
| Caddy 2 | caddy:2-alpine | 80, 443 | Public (HTTPS Let's Encrypt) |

## Neo4j — état des données

- **Graphe Musy bâtiment 96** : 14 noeuds, 18 relations
- **Ontologie** : 4 types de noeuds (Territoire, Acteur, Flux, Decision), 9 types de relations
- **Authentification** : mot de passe set via cypher-shell (NEO4J_AUTH: none dans docker-compose)

## PostGIS — état des données

- Base `rhiza`, user `rhiza`
- Vide — prêt pour l'import des données géo (parcelles, bâtiments)

## Caddy — configuration

- Reverse proxy HTTPS vers Neo4j Browser (phase 1)
- Certificat Let's Encrypt automatique pour api.rhiza.ch
- Headers de sécurité : nosniff, SAMEORIGIN, strict-origin-when-cross-origin

## Sécurité

- **SSH** : clé uniquement, root désactivé, PasswordAuthentication no
- **Firewall Infomaniak** : ports 22, 80, 443 (TCP) ouverts
- **Firewall UFW** : ports 22, 80, 443/tcp, 443/udp ouverts
- **Bases de données** : ports bindés sur 127.0.0.1, inaccessibles depuis Internet
- **Secrets** : `.env` sur le VPS uniquement, jamais commité

## Accès depuis le PC

```
Host rhiza
    HostName api.rhiza.ch
    User rhiza
    IdentityFile ~/.ssh/iteract-vps
    LocalForward 7474 localhost:7474
    LocalForward 7687 localhost:7687
```

```bash
ssh rhiza
# puis http://localhost:7474 dans le navigateur
```

## Pas encore déployé

- Backend Node.js / TypeScript / Fastify
- Frontend React + TypeScript + Zustand
- Vue cartographique MapLibre GL JS
- Vue graphe Sigma.js v3
- Données géo PostGIS (parcelles, bâtiments)
- Backup automatique des volumes Docker
