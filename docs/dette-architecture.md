# Dette d'architecture — suivi local

Miroir local de la page Notion dette. Chaque entrée a un ID, un jalon
d'origine, une description, et le jalon cible de résolution.

---

## D17 — Noeuds orphelins invisibles dans l'arbre Territoires
- **Origine** : J8b Sprint 2
- **Description** : Les 634+ noeuds créés par pipeline (J8b) n'ont pas d'arête CONTENU_DANS. Ils sont invisibles dans l'arbre Territoires qui filtre sur la hiérarchie parent-enfant. Le compteur header affiche le total Postgres (incluant les orphelins).
- **Résolution** : J7 — les patterns spatiaux/attributaires rattacheront les noeuds via CONTENU_DANS.
- **Contournement** : aucun Sprint 2. Les orphelins existent en base mais ne sont pas visualisés.

## D18 — Mapping non persisté côté source (draft local)
- **Origine** : J8b Sprint 2
- **Description** : Le mapping (fieldMappings, patterns, matching config) est persisté dans `draft_config` JSONB sur `config.sources`. C'est un blob opaque, pas un modèle relationnel. Le J7 devra structurer le mapping en tables dédiées pour permettre les requêtes, la validation, et le versioning.
- **Résolution** : J7 — tables `config.source_mappings` et `config.source_patterns`.

## D19 — Action 'close' sur metier.audit (vidage de mapping)
- **Origine** : J8b Sprint 2
- **Description** : Le vidage d'un mapping (fermeture intentionnelle d'une provenance) nécessite un nouveau type d'action `close` dans `metier.audit`, distinct de `UPDATE` (correction de valeur). Sémantiquement : `close` = "cette source ne nourrit plus cette propriété". Implique ALTER TABLE CHECK + route backend + UI confirmation avec comptage.
- **Résolution** : J7 — avec les mappings persistés.

## D20 — Détection de changement source online
- **Origine** : J8b Sprint 2
- **Description** : Le bouton Play pour les sources online (WFS, OGC API) devrait être activé conditionnellement selon la détection de changement (timestamp WFS, ETag OGC API, diff capabilities). Variable selon endpoint, à instruire au cas par cas.
- **Résolution** : Sprint 3+ — quand les sources online seront câblées.

## D21 — Suppression source = fermeture de toutes les valeurs
- **Origine** : J8b Sprint 2
- **Description** : La suppression (archivage) d'une source devrait fermer toutes les valeurs qu'elle nourrit (`UPDATE metier.properties SET valid_to = now() WHERE source = ...`). Mêmes règles d'orphelinage que le vidage de mapping (D19).
- **Résolution** : J7 — pattern identique à D19 appliqué en cascade.

## D22 — SRID supposé LV95 sans détection
- **Origine** : J8b Sprint 2
- **Description** : Le moteur d'exécution GeoJSON suppose SRID 2056 (LV95) sans détection ni reprojection automatique du CRS du fichier uploadé.
- **Résolution** : Sprint 3 — détection via le champ `crs` du GeoJSON + reprojection PostGIS.

## D23 — Pas d'annulation d'exécution en cours
- **Origine** : J8b Sprint 2
- **Description** : Fermer la modale pendant une exécution ne l'annule pas (le backend continue). Le navigateur ferme juste la connexion UI.
- **Résolution** : Sprint 3 — abort controller côté frontend + flag d'annulation backend.

## D24 — executed_by toujours NULL
- **Origine** : J8b Sprint 2
- **Description** : La colonne `executed_by` dans `config.source_executions` est toujours NULL (pas de système d'auth actif Sprint 2).
- **Résolution** : Sprint 3 — quand l'auth sera en place, passer `request.user.id`.
