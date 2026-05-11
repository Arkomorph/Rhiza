# Diagnostic architecture post-Sprint 2

**Date** : 7 mai 2026
**Scope** : Frontend (React+Zustand), Backend (Node.js+Fastify+TypeScript), PostgreSQL+PostGIS, Neo4j
**Jalons couverts** : J5 (schema), J6 (datatable+arbre), J6.5 (observabilite), J8a (catalogue sources), J8b (moteur execution GeoJSON)
**Methode** : deletion test d'Ousterhout sur chaque module, cross-reference CONTEXT.md et ADRs

---

## 1. Synthese

Le codebase est dans un etat sain pour un Sprint 2. Les stores Zustand sont bien separes, le backend a une architecture de routes coherente avec audit et validation Zod. Les problemes structurels sont concentres dans trois zones : (a) App.jsx est devenu un God Component qui heberge 200+ lignes de mock d'execution morte, (b) trois fichiers `data/` sont du code mort depuis que le Schema vit en base, (c) la duplication de la fonction `audit()` dans les routes backend cree un risque de derive silencieuse.

---

## 2. Modules superficiels candidats

### 2.1. `frontend/src/data/ontology.js` — CODE MORT

- **Raison du soupcon** : Exporte `INITIAL_ONTOLOGY_TREE` mais aucun import n'existe dans tout le frontend. Grep confirme : zero reference.
- **Deletion test** : suppression sans impact. Le Schema vit desormais dans Postgres via `useSchemaStore.fetchAll()`.
- **Recommandation** : **Supprimer.** Ce fichier est un vestige du proto — 322 lignes mortes. Son maintien cree un risque de confusion quand un nouveau contributeur ne sait pas laquelle des deux sources est la bonne.

### 2.2. `frontend/src/data/derived-props.js` — CODE MORT

- **Raison du soupcon** : Exporte `initialDerivedProps` mais aucun import n'existe dans le frontend.
- **Deletion test** : suppression sans impact. Les proprietes derivees sont en state local dans App.jsx (`derivedProps`), pas initialisees depuis ce fichier.
- **Recommandation** : **Supprimer.** 58 lignes mortes.

### 2.3. `frontend/src/data/catalog.js` — PARTIELLEMENT MORT

- **Raison du soupcon** : Exporte `CATALOG` (8 sources hardcodees) et `SCHEMA_PROPS` (mock). `CATALOG` est encore importe par App.jsx, CreateNodeModal.jsx et SourceStepper.jsx — mais uniquement comme fallback quand une source n'est pas trouvee via le store API. `SCHEMA_PROPS` n'est importe nulle part (grep confirme: seule reference = sa declaration).
- **Deletion test** :
  - `SCHEMA_PROPS` : supprimer sans impact.
  - `CATALOG` : les 3 imports sont des fallback dans des chemins d'edition legacy. Avec le store `useSourcesStore` en place, les Sources viennent de l'API. Le fallback CATALOG ne sert que si `sourcesStore.sources` ne contient pas la source cherchee.
- **Recommandation** : **Supprimer `SCHEMA_PROPS`** immediatement. **Marquer `CATALOG`** en deprecation explicite — le supprimer apres validation que `openSourceStepperEdit` n'est jamais appele sur une source absente du store.

### 2.4. `frontend/src/data/edge-types.js` — PARTIEL

- **Raison du soupcon** : Exporte `INITIAL_EDGE_TYPES` (non importe nulle part — mort) et `SPATIAL_OPS` + `compatibleSpatialOps` (importes par SourceStepper — vivants).
- **Deletion test** : `INITIAL_EDGE_TYPES` supprimable. Les deux exports spatiaux sont des invariants techniques (quelles methodes PostGIS pour quelles geometries) — pas du domaine Schema, donc legitimes en tant que constantes.
- **Recommandation** : **Supprimer `INITIAL_EDGE_TYPES`**. Renommer le fichier en `spatial-ops.js` pour refleter ce qu'il contient reellement.

### 2.5. `frontend/src/helpers/spatial.js` — SUPERFICIEL

- **Raison du soupcon** : 3 fonctions exportees, 18 lignes.
  - `TYPE_FAMILY` : hardcode la liste des sous-types Territoire. Probleme : quand on ajoute un sous-type dans le Schema en base, cette liste n'est pas mise a jour. Le store `useSchemaStore.typesByFamily` calcule deja la meme chose dynamiquement.
  - `getIntermediaryTypes` : importe dans SourceStepper mais remplacable par une lecture de `territoireCanonical` du store.
  - `compatibleEdges` : filtre trivial sur un tableau — 2 lignes, inline possible.
- **Deletion test** : `TYPE_FAMILY` est la plus dangereuse a garder — source de verite parallele au Schema en base. Les deux autres sont des one-liners.
- **Recommandation** : **Inliner ou supprimer.** `TYPE_FAMILY` en priorite : utiliser `useSchemaStore.typesByFamily` partout. Les deux autres peuvent etre inlinees dans SourceStepper.

### 2.6. `frontend/src/helpers/enum.js` — GARDER

- **Raison du soupcon** : 3 exports, 16 lignes. Tres petit.
- **Deletion test** : suppression deplacerait la logique de normalisation enum dans SchemaPage (qui l'appelle via `previewEnumValues`). La normalisation est une responsabilite distincte de l'affichage.
- **Recommandation** : **Garder.** Module petit mais utile — la normalisation `string → {value, label, code_externe}` est reelle.

### 2.7. `frontend/src/config/constants.js` — QUESTION

- **Raison du soupcon** : Exporte `ROOT`, `INDENT`, `CASCADE_OFFSET`. `ROOT` est encore utilise ? Grep montre que le store a un noeud racine reel en base (D15). Mais `ROOT` est importe dans App.jsx.
- **Deletion test** : `INDENT` et `CASCADE_OFFSET` sont des constantes de layout utilisees par TreeNode — legitimes. `ROOT` est un vestige si la racine vient desormais de la base.
- **Recommandation** : **Verifier si `ROOT` est encore utilise au runtime** (grep montre import dans App.jsx mais pas d'utilisation directe visible — possiblement mort depuis que `useTerritoiresStore` fournit `rootNode`).

---

## 3. Couplages excessifs

### 3.1. App.jsx — God Component (CRITIQUE)

`App.jsx` cumule :
- Orchestration des pages (routage par state)
- Etat de 6 modales differentes (createModal, archiveModal, addSourceModal, sourceStepper, addPropModal + leurs drafts)
- Mock complet de l'execution de source (lignes 280-443, `executeSource`) — 160 lignes de logique de mock avec tirage aleatoire, geometries, decisions automatiques
- Logique d'archivage et ses descendants
- SVG layout effect pour l'arbre d'archivage
- Stepper draft initialization (3 fonctions quasi-identiques : `openSourceStepperCreate`, `openSourceStepperEdit`, `openSourceStepperExecute`)

**Probleme specifique** : `openSourceStepperCreate`, `openSourceStepperEdit` et `openSourceStepperExecute` partagent ~80% de leur code (initialisation du `stepperDraft`). Trois copies quasi-identiques d'un meme objet de 30 champs. Quand un champ est ajoute au draft, il faut le mettre a jour a 3 endroits.

**Probleme specifique** : `executeSource` (lignes 280-443) est un mock local complet qui genere des noeuds factices. Il n'est reference nulle part dans le code actuel — les executions passent desormais par `sourcesStore.executeSource` (POST `/sources/:id/execute`). Ce sont 160 lignes mortes qui ajoutent de la confusion.

**Recommandation** : Extraire l'initialisation du stepper draft dans un helper (1 fonction parametree au lieu de 3), supprimer `executeSource` et les imports morts (`CATALOG` dans App.jsx n'est probablement plus utilise au runtime).

### 3.2. SchemaPage — mutations locales vs store API

SchemaPage recoit `setOntologyTree` et `setEdgeTypes` en props depuis App.jsx. Mais dans App.jsx, ces fonctions sont des **noop** :
```js
const setOntologyTree = () => { /* noop — mutations via store.addProperty/updateProperty/etc */ };
const setEdgeTypes = () => { /* noop — mutations via store.addEdgeProperty/etc */ };
```

Pourtant, SchemaPage et ses modales (IntrinsicPropModal, SubtypeModal, ExpectationModal, etc.) appellent toutes `setOntologyTree(treeRemoveProp(...))` comme si c'etait une vraie mutation. Les mutations sont en fait gerees par les modales qui appellent l'API du store Zustand (`schemaStore.addProperty`, etc.) et font `fetchAll()` apres.

**Resultat** : les appels a `setOntologyTree` dans SchemaPage et ses modales sont tous des appels noop qui ne font rien — mais le code les ecrit comme s'ils faisaient quelque chose. C'est trompeur. Quand une modale cree un sous-type, elle appelle le store API puis fait `fetchAll()` — le `setOntologyTree(treeAddSubtype(...))` qui suit est mort.

**Recommandation** : Nettoyer le contrat — soit les modales mutent le store directement (actuel), soit elles mutent un arbre local. Pas les deux en parallele avec l'un des deux noop.

### 3.3. SourceStepper — acces multi-store direct

SourceStepper importe et utilise directement 3 stores Zustand (`useSchemaStore`, `useSourcesStore`, `useTerritoiresStore`) en plus de recevoir 14 props depuis App.jsx. Certaines props dupliquent ce que les stores fournissent deja (`ontologyTree`, `getSchemaPropsForType`, `edgeTypes`). L'enfant SourceStepper pourrait lire ces valeurs du store directement au lieu de les recevoir en prop-drilling.

**Note** : la dette SourceStepper monolithique est acceptee (critere de declenchement connu). Le prop-drilling redondant est un sous-probleme distinct et facile a corriger.

### 3.4. DonneesPage — fetch direct `fetch()` hors store

DonneesPage fait des `fetch()` directes vers l'API (`${API_BASE}/sources?include_archived=true`) en parallele du store `useSourcesStore`. Le store gere deja la liste des sources actives, mais DonneesPage reconstruit sa propre logique de fetch pour les archivees. Resultat : deux mecanismes de cache paralleles pour les memes donnees.

---

## 4. Duplications

### 4.1. Fonction `audit()` dupliquee dans le backend (RISQUE)

Trois implementations de la meme logique d'audit :
- `backend/src/audit.ts` — `auditMetier()` vers `metier.audit`
- `backend/src/routes/schema.ts` — `audit()` locale vers `config.schema_audit`
- `backend/src/routes/sources.ts` — `audit()` locale vers `config.schema_audit`
- `backend/src/services/audit.service.ts` — `audit()` pour l'auth vers une autre table

Les deux fonctions `audit()` dans schema.ts et sources.ts sont identiques (meme signature, meme INSERT vers `config.schema_audit`). Si la structure de `config.schema_audit` change, il faut modifier les deux. Le risque de derive est reel.

**Recommandation** : Extraire une seule fonction `auditSchema()` dans un fichier partage, au meme titre que `auditMetier()` existe deja.

### 4.2. Palettes heritage — triplication dans SchemaPage

La fonction de palette heritage (background + barre laterale par distance) est ecrite 3 fois dans SchemaPage.jsx : une pour les proprietes intrinseques (lignes 289-299), une pour les proprietes derivees (lignes 467-477), une pour les aretes attendues (lignes 604-614). Exactement le meme code a chaque fois.

**Recommandation** : Extraire dans un helper `heritageStyle(distance)` retournant `{ background, barColor }`.

### 4.3. Pattern `const API_BASE = import.meta.env.VITE_API_URL || '...'` repete

Ce pattern apparait dans :
- `frontend/src/logger.js` (fallback `http://localhost:3000`)
- `frontend/src/sections/DonneesPage.jsx` (fallback `https://api.rhiza.ch`)
- `frontend/src/sections/TerritoiresPage.jsx` (fallback `https://api.rhiza.ch`)
- `frontend/src/stores/useSchemaStore.js` (fallback `https://api.rhiza.ch`)
- `frontend/src/stores/useSourcesStore.js` (fallback `https://api.rhiza.ch`)
- `frontend/src/stores/useTerritoiresStore.js` (fallback `https://api.rhiza.ch`)
- `frontend/src/stores/useLogsStore.js` (fallback `https://api.rhiza.ch`)

Le fallback est **incoherent** : `logger.js` utilise `http://localhost:3000` alors que tous les autres utilisent `https://api.rhiza.ch`. En dev local sans `VITE_API_URL`, le logger envoie vers `localhost:3000` mais les stores vers `api.rhiza.ch`. C'est une source de bugs silencieux.

**Recommandation** : Centraliser dans un seul fichier `config/api.js` exportant `API_BASE`. Aligner le fallback (probablement `http://localhost:3000` pour le dev).

---

## 5. Contradictions code <-> CONTEXT.md ou ADRs

### 5.1. CLAUDE.md dit "Sprint actuel — Sprint 1"

CLAUDE.md section "Sprint actuel" indique encore Sprint 1, alors que le Sprint 2 est clos. Le reste de CLAUDE.md est coherent mais cette section est perimee.

### 5.2. CLAUDE.md dit "Frontend : React + TypeScript + Zustand"

Le frontend est en fait React + **JavaScript** (`.jsx`) + Zustand. Aucun fichier TypeScript n'existe cote frontend. Ce n'est pas un bug technique mais une divergence documentation/realite. CONTEXT.md dit la meme chose ("React + TypeScript + Zustand") — meme erreur.

### 5.3. `TYPE_FAMILY` hardcode vs Schema dynamique

`helpers/spatial.js` ligne 6 :
```js
if (["Canton", "Commune", "Secteur", "Quartier", "Parcelle", "Batiment", "Unite", "Piece", "Suisse"].includes(t)) return "Territoire";
```
Cette liste statique contredit le principe "le Schema est la source de verite" de CONTEXT.md ("Le Schema definit les proprietes et les Aretes attendues de chaque type"). Si un sous-type `Corridor` est ajoute au Schema via l'UI, `TYPE_FAMILY` ne le reconnaitra pas comme Territoire.

### 5.4. `SCHEMA_PROPS` dans catalog.js vs Schema en base

Le fichier `data/catalog.js` contient un `SCHEMA_PROPS` marque "PROVISOIRE : au parcours 5, cette liste viendra du Schema dynamique". Le parcours 5 est desormais clos (Jalon 5 = Schema persistant). L'export est mort mais le commentaire suggere qu'il devrait etre en base — c'est le cas, donc le fichier est simplement obsolete.

### 5.5. Moteur d'execution ne cree pas d'aretes CONTENU_DANS

CONTEXT.md et les expected_edges declarent que tout sous-type Territoire a une arete CONTENU_DANS hard vers un parent. Le moteur d'execution `POST /sources/:id/execute` (sources.ts ligne 357) cree le noeud Neo4j sans aucune arete. C'est documente dans D17 (dette-architecture.md), mais la consequence est que 100% des noeuds crees par pipeline sont orphelins et invisibles dans l'arbre Territoires. C'est coherent avec la roadmap (J7 resoudra), mais merite d'etre souligne.

### 5.6. ADR-002 mentionne "synchronisation transactionnelle" des labels

ADR-002 dit : "Changement de nature = deux operations dans la meme transaction : mutation des labels Neo4j + insertion dans la table versionnee." En realite, `POST /territoires` cree le noeud Neo4j apres la transaction Postgres, pas dans la meme transaction (pas de distributed tx). La compensation est implementee (DELETE Postgres si Neo4j echoue), mais ce n'est pas une "transaction" au sens strict. C'est acceptable pragmatiquement, mais l'ADR devrait le preciser.

---

## 6. Top 3 recommandations avant J7

### R1. Nettoyer App.jsx — supprimer le mock `executeSource` et factoriser les stepper openers (S)

**Effort** : S (1-2h)
**Justification** : `executeSource` est 160 lignes de code mort — les executions passent desormais par le backend. Les 3 fonctions `openSourceStepper*` partagent 80% de leur code. Factoriser en une seule fonction parametree reduit le risque d'oubli quand un champ est ajoute au draft. Le ratio signal/bruit de App.jsx s'ameliore fortement.
**Risque si on ne le fait pas** : J7 ajoutera des champs au stepper draft (mappings persistes, patterns relationnels). Chaque ajout devra etre reporte manuellement dans 3 fonctions quasi-identiques.

### R2. Centraliser `API_BASE` et aligner le fallback (S)

**Effort** : S (30min)
**Justification** : L'incoherence de fallback `localhost:3000` vs `api.rhiza.ch` est un bug latent. Toute session de dev sans `VITE_API_URL` envoie les logs warn/error vers localhost mais les requetes de donnees vers la production. Centraliser dans `config/api.js` elimine le probleme et les 7 repetitions.

### R3. Supprimer les fichiers data morts et `TYPE_FAMILY` hardcode (S)

**Effort** : S (1h)
**Justification** : `data/ontology.js` (322 lignes), `data/derived-props.js` (58 lignes), `INITIAL_EDGE_TYPES` dans `data/edge-types.js` (81 lignes), `SCHEMA_PROPS` dans `data/catalog.js` — tout ce code est mort depuis que le Schema vit en base (J5). `TYPE_FAMILY` dans `helpers/spatial.js` est pire : c'est du code vivant avec une source de verite parallele au Schema. J7 ajoutera des sous-types — `TYPE_FAMILY` cassera silencieusement.

---

## Annexe — Modules passes au deletion test sans probleme

| Module | Verdict | Raison |
|---|---|---|
| `ModalShell.jsx` | Garder | Shell reel avec variation par props, 7+ consommateurs |
| `DataTable.jsx` | Garder | Composant generique avec tri, background conditionnel — utilise partout |
| `Icon.jsx` | Garder | Encapsule 7 icones Phosphor duotone, elimine la dependance package |
| `TreeNode.jsx` | Garder | Recursion reelle avec cascade spatiale derivee du Schema |
| `logger.js` | Garder | Ring buffer + intercepteurs globaux + format Claude — module a responsabilite propre |
| `useSchemaStore.js` | Garder | Store Zustand le plus riche, derivees bien calculees dans fetchAll |
| `useSourcesStore.js` | Garder | Pattern coherent avec les autres stores |
| `useTerritoiresStore.js` | Garder | Pattern coherent, stubs Sprint 2 documentes |
| `useLogsStore.js` | Garder | Responsabilite propre (polling backend), dedup correcte |
| `helpers/ontology.js` | Garder | Logique d'arbre reelle (heritage, mutations immutables) — cible de bugs si inline |
| `helpers/patterns.js` | Garder | Validation des patterns — logique testable separement |
| `helpers/colors.js` | Garder | `lighten` et `colorForOntologyPath` — utilitaires purs bien places |
| `helpers/enum.js` | Garder | Normalisation enum canonique — petit mais reel |
| `config/theme.js` | Garder | Tokens de design centralises |
| `config/palettes.js` | Garder | Palettes couleur par type — donnee de config |
| `backend/src/audit.ts` | Garder | `auditMetier` bien type — mais la duplication dans les routes est a resoudre |
| `backend/src/helpers.ts` | Garder | `propertyColumns` est petit mais evite la duplication type-dispatch |
| `backend/src/plugins/*` | Garder | Plugins Fastify bien structures, responsabilites claires |
| `backend/src/db/*` | Garder | Connecteurs minimaux, migrate idiomatique |

---

## Points non examines (hors scope Sprint 2)

- Performance des requetes PostgreSQL (pas de EXPLAIN ANALYZE sans donnees reelles)
- Securite des routes (auth non branchee Sprint 2 — D24 le documente)
- Tests (aucun test unitaire ou integration — coherent avec les principes de dev notes dans MEMORY)
- Accessibilite frontend (pas de ARIA, navigation clavier limitee)
