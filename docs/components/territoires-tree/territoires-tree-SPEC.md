# Composant Territoires-Tree — Référentiel canonique

**Référence visuelle canonique** : `docs/Proto/rhiza-proto-v2(2).jsx` (composant `TreeNode` et `TerritoiresPage` à l'intérieur). Toute divergence de l'implémentation production par rapport au proto doit être justifiée par un commit avec référence explicite à la décision (typiquement un § d'Annexe Notion ou une dette inscrite).

---

## Structure générale

Arbre SVG vertical avec lignes de connexion parent → enfant imbriquées par niveau de profondeur. Chaque nœud est rendu sous forme de **pastille** rectangulaire arrondie, alignée à l'indentation correspondant à sa profondeur dans la hiérarchie spatiale.

À gauche de chaque pastille, un **dot circulaire** coloré selon le sous-type. Lignes SVG de connexion calculées dynamiquement après rendu (useLayoutEffect) — voir `App.jsx` pour le mécanisme et `useTerritoiresStore` pour la donnée.

---

## Pastille — anatomie

De gauche à droite :

1. **Dot** circulaire (couleur dérivée du sous-type, voir légende TYPES)
2. **Label en majuscules grasses** (le nom du nœud — ex. "SCHOENBERG", "MUSY 5", ou "—" si non nommé)
3. **Sous-type** en italique discret (ex. "Secteur", "Quartier", "Bâtiment")
4. *flex grow*
5. **Badge de statut** (voir section États ci-dessous)
6. **Bouton crayon violet** (édition) — visible si `canUpdate` (cf. décision N du J6, capability check)
7. **Bouton poubelle rouge** (suppression) — visible si `canDelete`

---

## États du nœud

| État | Quand | Apparence |
|------|-------|-----------|
| **actif** | nœud peuplé avec données fiables | pastille pleine, badge "actif" |
| **brouillon** | nœud créé par import sans validation explicite | pastille pleine, badge "brouillon" gris |
| **à nommer** | nœud créé manuellement via cascade "+", pas encore renommé | pastille pleine, label "—", badge "à nommer" |
| **à créer** | placeholder de cascade non encore matérialisé | pastille en dashed, pas de badge, clic = création |

Les nœuds Musy actuellement seedés sont en état **brouillon** (cohérent avec le seed Sprint 1).

---

## Cascades "+" sous chaque nœud

**Source de vérité (D13)** : les cascades "+" sont dérivées des `expected_edges ContenuDans incoming` du sous-type courant, via `useSchemaStore.territoireChildrenOf`. Pas de chaîne canonique hardcodée.

Sous un nœud de sous-type X, afficher en cascade :
- En **gras** + couleur d'accent : les sous-types qui ont `ContenuDans → X` déclaré (enfants directs spatiaux), précédés de `+`
- En **texte normal** : les sous-types descendants plus lointains (enfants des enfants, etc.) jusqu'à la feuille

Exemples attendus à l'état actuel du Schéma :

- Sous **Suisse (root)** : `+ Canton  Commune  Secteur  Quartier  Parcelle  Bâtiment  Unité  Pièce`
- Sous **Schoenberg (Secteur)** : `+ Quartier  Parcelle  Bâtiment  Unité  Pièce`
- Sous **Musy (Quartier)** : `+ Parcelle  Bâtiment  Unité  Pièce`
- Sous **Parcelle 14345** : `+ Bâtiment  Unité  Pièce`
- Sous **Musy 5 (Bâtiment)** : `+ Unité  Pièce`

Le clic sur un `+` matérialise un nœud "à créer" — l'utilisateur le renomme ensuite.

---

## Légende (en bas du composant)

Trois lignes obligatoires :

1. **TYPES** — un dot par sous-type Territoire présent dans le Schéma, dans l'ordre alphabétique. Source : `useSchemaStore.territoireSubtypes`.
2. **STATUTS** — un indicateur visuel par état (actif, brouillon, à nommer, à créer). Liste fixe.
3. **Compteurs** — `PostgreSQL : N nœuds · Neo4j : N relations Contenu_dans`. Sources : longueur du store territoires côté Postgres, et requête sur les arêtes ContenuDans côté Neo4j (à exposer via API si pas déjà fait).

---

## Couleurs et dimensions

Voir les design tokens dans le proto v2 — sections de constantes en haut de `rhiza-proto-v2(2).jsx`. À ne pas modifier sans décision explicite (Annexe Design ou commit de refonte UX justifiée).

---

## Boutons "Points d'entrée de modélisation"

À l'état initial (arbre vide ou racine seule), des boutons de cascade "+" apparaissent sous le nœud Suisse pour permettre la création manuelle d'un Canton, Commune, etc. Ces boutons ne sont pas un mode différent — ils suivent exactement la mécanique des cascades décrite plus haut, simplement plus visibles parce qu'aucun enfant n'existe encore.

**Capability** : `canCreate = true` Sprint 2 (POST /territoires existe). `canUpdate` et `canDelete` restent `false` jusqu'à ce que les routes PATCH et DELETE soient implémentées (Sprint 3, cf. dette n°12).

---

## Discipline de fidélité au proto

Toute modification de ce composant doit :

1. Soit reproduire fidèlement le proto v2 (cas par défaut)
2. Soit être justifiée par une décision explicite (typiquement un nouveau § dans cette SPEC ou dans une Annexe Notion référencée)
3. Donner lieu à une mise à jour de cette SPEC si le comportement change

L'absence de référentiel canonique entre J4 et le J6 a coûté plusieurs cycles de divergence silencieuse — voir dette n°15 dans la page Notion dédiée.
