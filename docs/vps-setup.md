# Rhiza — Montage du VPS Infomaniak

> VPS Ubuntu 24 LTS — 4 vCPU, 8 Go RAM, 160 Go NVMe
> Objectif : api.rhiza.ch avec Neo4j + PostGIS + Caddy

---

## Pré-requis

- [ ] VPS commandé sur Infomaniak (Ubuntu 24.04 LTS)
- [ ] Accès au panneau DNS d'Infomaniak pour rhiza.ch
- [ ] L'IP du VPS (visible dans le panneau Infomaniak, notée `IP_VPS` ci-dessous)

---

## Étape 0 — DNS

Avant tout, crée l'enregistrement DNS pour que `api.rhiza.ch` pointe vers le VPS.

**Dans le panneau Infomaniak → Domaines → rhiza.ch → Zone DNS :**

| Type | Nom   | Valeur     | TTL  |
|------|-------|------------|------|
| A    | api   | `IP_VPS`   | 3600 |

**Vérifier** (depuis ton PC, après quelques minutes) :

```bash
nslookup api.rhiza.ch
```

Tu dois voir l'IP de ton VPS dans la réponse. Si ça ne marche pas encore,
attends 5-10 min (propagation DNS).

---

## Étape 1 — Premier accès SSH

### 1.1 Se connecter en root

Infomaniak te donne un mot de passe root par email ou dans le panneau.

```bash
ssh root@IP_VPS
```

> Première connexion : il te demande de confirmer l'empreinte du serveur.
> Tape `yes` puis entre le mot de passe root.

### 1.2 Mettre à jour le système

```bash
apt update && apt upgrade -y
```

**Ce que ça fait :** télécharge et installe toutes les mises à jour de sécurité.

### 1.3 Créer un utilisateur non-root

Ne jamais travailler en root au quotidien. On crée un utilisateur `rhiza` :

```bash
adduser rhiza
```

> Il te demande un mot de passe — choisis-en un solide et note-le.
> Les autres champs (Full Name, etc.) : appuie sur Entrée pour les laisser vides.

Donne-lui les droits sudo :

```bash
usermod -aG sudo rhiza
```

### 1.4 Configurer l'accès par clé SSH

**Sur ton PC** (pas sur le VPS), vérifie si tu as déjà une clé :

```bash
ls ~/.ssh/id_ed25519.pub
```

Si le fichier n'existe pas, crée une clé :

```bash
ssh-keygen -t ed25519 -C "jo@rhiza"
```

> Appuie sur Entrée pour le chemin par défaut. Mets une passphrase si tu veux.

Copie la clé sur le VPS :

```bash
ssh-copy-id rhiza@IP_VPS
```

> Entre le mot de passe de l'utilisateur `rhiza`.

**Vérifier :** connecte-toi sans mot de passe :

```bash
ssh rhiza@IP_VPS
```

Si ça marche, on continue.

### 1.5 Sécuriser SSH

**Sur le VPS** (connecté en tant que `rhiza`) :

```bash
sudo nano /etc/ssh/sshd_config
```

Cherche et modifie ces lignes (ou ajoute-les si absentes) :

```
PermitRootLogin no
PasswordAuthentication no
```

Sauvegarde (`Ctrl+O`, Entrée, `Ctrl+X`) puis redémarre SSH :

```bash
sudo systemctl restart ssh
```

> **IMPORTANT :** garde ta session SSH ouverte et ouvre un DEUXIÈME terminal
> pour vérifier que tu peux encore te connecter :
>
> ```bash
> ssh rhiza@IP_VPS
> ```
>
> Si ça marche → c'est bon. Si ça échoue → tu as encore l'autre session
> pour corriger.

### 1.6 Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirection Caddy)
sudo ufw allow 443/tcp   # HTTPS (Caddy)
sudo ufw allow 443/udp   # HTTP/3
sudo ufw enable
```

Il te demande confirmation → tape `y`.

**Vérifier :**

```bash
sudo ufw status
```

Tu dois voir les 4 ports ouverts (22, 80, 443 tcp, 443 udp).

> **Note :** les ports Neo4j (7474, 7687) et PostgreSQL (5432) ne sont PAS
> ouverts. Ils ne sont accessibles que depuis le VPS lui-même ou par SSH tunnel.
> C'est voulu — on ne veut pas que les bases soient accessibles depuis Internet.

---

## Étape 2 — Installer Docker

### 2.1 Installer Docker Engine

```bash
# Ajouter le dépôt officiel Docker
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

### 2.2 Permettre à `rhiza` d'utiliser Docker sans sudo

```bash
sudo usermod -aG docker rhiza
```

**Déconnecte-toi et reconnecte-toi** pour que le groupe prenne effet :

```bash
exit
ssh rhiza@IP_VPS
```

### 2.3 Vérifier

```bash
docker --version
docker compose version
docker run --rm hello-world
```

Tu dois voir :
- La version de Docker (≥ 27.x)
- La version de Compose (≥ 2.x)
- Le message "Hello from Docker!"

---

## Étape 3 — Structure du projet sur le VPS

### 3.1 Cloner le repo

```bash
cd ~
git clone https://github.com/Arkomorph/Rhiza.git
cd Rhiza
```

### 3.2 Créer le fichier .env

```bash
cp .env.example .env
nano .env
```

**Change les mots de passe !** Utilise des vrais mots de passe solides.

Sauvegarde (`Ctrl+O`, Entrée, `Ctrl+X`).

**Vérifier** que `.env` ne sera jamais commité :

```bash
git status
```

Le fichier `.env` ne doit PAS apparaître (il est dans `.gitignore`).

### 3.3 Structure résultante

```
~/Rhiza/
├── conf/
│   ├── Caddyfile          # Config reverse proxy
│   └── neo4j.conf         # Config Neo4j
├── schema/
│   └── musy_96.cypher     # Données à importer
├── docs/
│   └── vps-setup.md       # Ce fichier
├── docker-compose.yml     # Tout est là
├── .env                   # Secrets (jamais commité)
└── .env.example           # Template
```

---

## Étape 4 — Lancer les services

### 4.1 Démarrer tout

```bash
cd ~/Rhiza
docker compose up -d
```

**Ce que ça fait :**
- Télécharge les images Docker (Neo4j, PostGIS, Caddy)
- Démarre les 3 conteneurs
- Caddy obtient automatiquement un certificat Let's Encrypt pour api.rhiza.ch

> Premier lancement : ~2-3 minutes pour tout télécharger.

### 4.2 Vérifier que les conteneurs tournent

```bash
docker compose ps
```

Tu dois voir 3 conteneurs avec le statut `Up` ou `Up (healthy)` :

```
NAME            IMAGE                   STATUS
rhiza-neo4j     neo4j:5-community       Up (healthy)
rhiza-postgis   postgis/postgis:16-3.4  Up (healthy)
rhiza-caddy     caddy:2-alpine          Up
```

Si un conteneur est en `Restarting` ou `Exit`, regarde les logs :

```bash
docker compose logs neo4j    # ou postgis, ou caddy
```

### 4.3 Vérifier Caddy + HTTPS

Depuis ton PC :

```bash
curl -I https://api.rhiza.ch
```

Tu dois voir `HTTP/2 200` ou une réponse de Neo4j Browser. Si tu vois une
erreur de certificat, attends 1-2 minutes que Caddy obtienne le certificat.

### 4.4 Vérifier Neo4j via SSH tunnel

Neo4j n'est pas exposé publiquement. On y accède par tunnel SSH.

**Sur ton PC :**

```bash
ssh -L 7474:localhost:7474 -L 7687:localhost:7687 rhiza@api.rhiza.ch
```

> Cette commande ouvre un tunnel : ton `localhost:7474` → le port 7474 du VPS.
> Laisse cette session ouverte.

**Dans ton navigateur :** ouvre `http://localhost:7474`

Tu verras Neo4j Browser. Connecte-toi avec :
- URL : `bolt://localhost:7687`
- User : `neo4j`
- Password : le mot de passe que tu as mis dans `.env`

---

## Étape 5 — Importer le graphe Musy

### 5.1 Importer depuis le repo

Le fichier `musy_96.cypher` est déjà dans le repo, monté dans le conteneur.

```bash
cd ~/Rhiza
docker exec -i rhiza-neo4j cypher-shell \
  -u neo4j \
  -p "$(grep NEO4J_PASSWORD .env | cut -d= -f2)" \
  < schema/musy_96.cypher
```

**Vérifier :** compte les noeuds et relations :

```bash
docker exec rhiza-neo4j cypher-shell \
  -u neo4j \
  -p "$(grep NEO4J_PASSWORD .env | cut -d= -f2)" \
  "MATCH (n) RETURN count(n) AS noeuds"
```

Résultat attendu : **14**

```bash
docker exec rhiza-neo4j cypher-shell \
  -u neo4j \
  -p "$(grep NEO4J_PASSWORD .env | cut -d= -f2)" \
  "MATCH ()-[r]->() RETURN count(r) AS relations"
```

Résultat attendu : **18**

---

## Étape 6 — Vérification finale

### 6.1 Checklist

Depuis le VPS :

```bash
cd ~/Rhiza

# 1. Les 3 conteneurs tournent ?
docker compose ps

# 2. Neo4j répond ?
docker exec rhiza-neo4j cypher-shell \
  -u neo4j \
  -p "$(grep NEO4J_PASSWORD .env | cut -d= -f2)" \
  "RETURN 'Neo4j OK' AS status"

# 3. PostGIS répond ?
docker exec rhiza-postgis psql -U rhiza -d rhiza -c "SELECT PostGIS_Version();"

# 4. HTTPS fonctionne ?
curl -s https://api.rhiza.ch | head -5
```

### 6.2 Requête Cypher de validation

Ouvre Neo4j Browser (via SSH tunnel) et lance cette requête qui montre tout le
graphe Musy :

```cypher
MATCH (n)-[r]->(m)
RETURN n, r, m
```

Tu dois voir **14 noeuds** et **18 relations** — le cas Musy complet :
- 4 Territoire (Schönberg → Musy → Parcelle → Bâtiment 96)
- 5 Acteur (Realstone, Locataires, SAC, Énergie, Fournisseur)
- 1 Flux (Réseau gaz)
- 4 Décision (Rénovation, Demande permis, Octroi permis, Subvention)

### 6.3 Requête bonus — le paradoxe Musy

```cypher
// Qui décide, qui subit ?
MATCH (a:Acteur)-[:DECIDE_SUR]->(d:Decision)-[:IMPACTE]->(t:Territoire)
RETURN a.nom AS decideur, d.nom AS decision, t.nom AS impacte
```

---

## Commandes utiles au quotidien

```bash
# Voir les logs en temps réel
docker compose logs -f

# Redémarrer un service
docker compose restart neo4j

# Tout arrêter
docker compose down

# Tout arrêter ET supprimer les données (attention !)
docker compose down -v

# Mettre à jour les images
docker compose pull && docker compose up -d

# Mettre à jour le code depuis GitHub
cd ~/Rhiza && git pull && docker compose up -d
```

---

## Accès SSH simplifié (sur ton PC)

Pour ne pas taper l'IP à chaque fois, ajoute ceci à `~/.ssh/config` sur ton PC :

```
Host rhiza
    HostName api.rhiza.ch
    User rhiza
    LocalForward 7474 localhost:7474
    LocalForward 7687 localhost:7687
```

Ensuite :

```bash
ssh rhiza
```

→ Connecté au VPS avec les tunnels Neo4j ouverts automatiquement.

---

## Architecture réseau

```
Internet
   │
   ├── :443 (HTTPS) ──→ Caddy ──→ Neo4j Browser (:7474)
   ├── :80  (HTTP)  ──→ Caddy ──→ redirect :443
   │
   │   (non exposés — SSH tunnel uniquement)
   ├── :7474 ──→ Neo4j Browser
   ├── :7687 ──→ Neo4j Bolt
   └── :5432 ──→ PostgreSQL/PostGIS
```

---

## Prochaines étapes

- [ ] Backend Rust/Axum : ajouter un service `axum` dans docker-compose.yml
- [ ] Caddy : basculer `api.rhiza.ch` de Neo4j vers Axum
- [ ] Frontend React sur rhiza.ch (hébergement Infomaniak)
- [ ] PostGIS : importer les données géo (parcelles, bâtiments)
- [ ] Backup automatique des volumes Docker
