# Composant Log-Page — Référentiel canonique

**Référence visuelle** : état post-J6.5. Toute divergence de l'implémentation par rapport à cette SPEC doit être justifiée par un commit avec référence explicite à la décision.

---

## Principe

Flux unifié chronologique : logs backend (Pino ring buffer) + logs frontend (logger.js ring buffer), mergés par timestamp, distingués par un marqueur B/F. Pas de WebSocket — REST polling 5s.

---

## Layout

Pleine largeur (max 1200px centré). Structure verticale :
1. Header (titre + boutons)
2. Badges compteurs (niveau + origine)
3. Filtres texte (module + recherche)
4. Table de logs
5. Compteur entrées

---

## Header

- Titre "LOGS" uppercase, Geist
- Indicateur d'erreur (rouge) si le fetch backend échoue
- Indicateur de chargement "..." pendant un fetch
- Bouton "Polling ON/OFF" — toggle vert (actif) / gris (inactif)
- Bouton "Copier pour Claude" — accent, copie le flux affiché au format texte structuré
- Bouton "Clear" — vide les deux buffers (backend + frontend)

---

## Badges compteurs

Deux groupes séparés par un séparateur vertical :

### Niveaux (gauche)
- debug (gris), info (bleu), warn (jaune), error (rouge)
- Chaque badge affiche le compteur total (avant filtres)
- Clic = toggle filtre sur ce niveau
- Actif = fond coloré + texte blanc ; inactif = fond alt + texte coloré

### Origine (droite)
- B (bleu #0588b0) = backend
- F (vert #14966b) = frontend
- Même mécanique de toggle

---

## Filtres texte

- Input "Module..." (140px) — filtre substring insensible à la casse sur le champ module
- Input "Recherche texte..." (flex) — filtre substring insensible à la casse sur le message

---

## Table de logs

Grille 5 colonnes : `90px 50px 24px 90px 1fr`

### En-tête
Heure | Level | (B/F) | Module | Message — fond alt, texte muted, uppercase 10px

### Ligne de log

| Colonne | Style | Contenu |
|---------|-------|---------|
| Heure | JetBrains Mono 10px, muted | `HH:MM:SS.mmm` |
| Level | Body 10px, bold, couleur par niveau, uppercase | `INFO`, `WARN`, etc. |
| B/F | JetBrains Mono 10px, bold, couleur par origine | `B` ou `F` |
| Module | JetBrains Mono 10px, muted, ellipsis | Nom du module (ex: `territoires`, `schema`) |
| Message | Body 11px, text | Message principal + indicateur `[data]` si payload présent |

- Alternance fond surface/bg
- Max height 600px, scroll vertical
- Tri : plus récents en haut

### Payload déplié

- Clic sur une ligne avec data = toggle du bloc payload
- Bloc `<pre>` sous la ligne, fond alt, JetBrains Mono 10px
- JSON indenté (2 espaces), `white-space: pre-wrap`, `word-break: break-all`
- `user-select: text` — sélectionnable proprement pour copier-coller
- Pas de markdown, pas de tableau imbriqué

---

## Format copie Claude

Texte brut, une ligne par log, plus récents en haut :
```
── Rhiza Logs (N entrées) ──────────────────
HH:MM:SS.mmm INFO  B [module] message
  → {"key": "value"}
HH:MM:SS.mmm WARN  F [source] message
```

Pas de markdown. Lisible par Claude Code en mode texte.

---

## Sources de données

| Source | Endpoint | Auth | Polling |
|--------|----------|------|---------|
| Backend logs | `GET /logs?limit=200&since=<ts>` | Bearer LOGS_TOKEN | 5s |
| Frontend logs | `log.getAll()` (ring buffer en mémoire) | — | Subscription |

---

## Store Zustand (useLogsStore)

| Champ | Type | Description |
|-------|------|-------------|
| backendLogs | array | Logs backend reçus depuis /logs |
| polling | boolean | État du polling (défaut: true) |
| intervalMs | number | Intervalle de polling (défaut: 5000) |
| loading | boolean | Fetch en cours |
| error | string/null | Dernière erreur |

Actions : `fetchBackendLogs()`, `startPolling()`, `stopPolling()`, `togglePolling()`, `clearBackendLogs()`

---

## États visuels

### Démarrage
- Polling démarre automatiquement au mount
- Fetch immédiat + intervalle 5s
- "Aucun log" si rien à afficher

### Erreur fetch
- Indicateur rouge dans le header
- Logs frontend continuent d'apparaître
- Polling continue (retry automatique)

### Token manquant
- Erreur "Token logs invalide" si 401
- Seuls les logs frontend s'affichent

### Polling désactivé
- Bouton gris "Polling OFF"
- Logs frontend continuent en temps réel
- Backend logs figés au dernier fetch
