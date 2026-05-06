# Composant Data-Page — Référentiel canonique

**Référence visuelle** : état post-J8b. Toute divergence de l'implémentation par rapport à cette SPEC doit être justifiée par un commit avec référence explicite à la décision.

---

## Layout

Deux colonnes :
- **Gauche (200px)** : barre latérale de filtrage par type/sous-type ontologique
- **Droite (flex)** : header + filtre texte + DataTable

---

## Barre latérale

- "Toutes (N)" en tête — affiche toutes les sources actives
- Arbre ontologique en lecture seule (réutilise `ontologyTypesGrouped` du store Schéma), ordre par imbrication spatiale (D13)
- Chaque type affiche son compteur de sources (`sourcesByTargetType`)
- "Sans type (N)" — sources avec `target_type = NULL`
- "Synchronisables (0)" — disabled Sprint 2, activé quand patterns configurés (J7). Critère : `target_type IS NOT NULL AND source_patterns count > 0`
- Bouton "↻ Synchro patterns (J7)" — placeholder disabled

---

## DataTable

7 colonnes + actions :

| Colonne | Largeur | Contenu |
|---------|---------|---------|
| ID | 0.5fr | Format `S001`, `S002`, ... |
| Nom | 1.8fr | Gras uppercase |
| Format | 0.7fr | WFS, GeoJSON, CSV, Shapefile, GeoPackage, INTERLIS |
| Portail | 0.8fr | Texte brut |
| Type cible | 0.8fr | Coloré par type, "—" si NULL |
| Statut | 0.8fr | Badge coloré + badge "incomplet" si pas d'endpoint |
| Actions | 90px | Play (conditionnel J8b) + Pencil (disabled J7) + Trash (actif) |

Au-dessus de la table : compteur résultats à gauche, bouton "↻ Synchro patterns" disabled à droite.

---

## Convention d'ID des sources

- Format : `S` suivi de 3+ chiffres (`S001` à `S999`, puis `S1000`, ...)
- Regex de validation backend : `^S\d{3,}$`
- Calcul côté frontend : `max(IDs existants) + 1`, pré-rempli à l'ouverture de la modale
- Store expose `nextId` calculé dans `fetchAll()`
- Unicité garantie par la PK Postgres (409 Conflict si doublon)

---

## Bouton suppression

- Icône poubelle rouge sur chaque ligne (actif)
- Modale de confirmation : "Archiver la source X ? Cette action est réversible."
- Au clic : `DELETE /sources/:id` (archivage logique, `archived_at = now()`)
- Refetch du store, ligne disparaît

---

## Modale "Nouvelle source"

- Step 1 : nom, format (dropdown 6 options), portail, target_type (dropdown types du Schéma)
- ID pré-rempli avec `nextId` du store, éditable
- "Sauvegarder & fermer" : `POST /sources`, refetch store, modale fermée
- "Suivant" : passe en Step 2 (draft local, pas de persistance — J7)
- Steps 2-3 restent en draft local Sprint 2

---

## Bouton Play — exécution (J8b)

### Conditions d'activation

| Condition | État du bouton |
|-----------|---------------|
| `target_type IS NOT NULL` ET `format = 'GeoJSON'` | Actif (vert accent) |
| `target_type IS NULL` | Désactivé, tooltip "Configurez d'abord le type cible" |
| `format != 'GeoJSON'` | Désactivé, tooltip "Format non supporté Sprint 2" |
| Exécution en cours sur cette source | Spinner "..." |

### Workflow exécution

Play et Pencil ouvrent la **même modale** (SourceStepper). Pas de mini-modale séparée.

- **Play** (DataTable) → ouvre sur **Step 1** (parce qu'on doit recharger le fichier à chaque exécution — D11)
- **Pencil** (DataTable) → ouvre sur **Step 1** (configuration source)

**Step 1 — fichier GeoJSON** :
- Le bouton "Parcourir..." est un vrai file picker (`<input type="file">`) pour les sources GeoJSON
- Au chargement : FileReader parse le JSON, vérifie FeatureCollection, extrait les champs depuis la première feature + nombre total
- Indicateur "{N} features détectées" sous le sélecteur
- Les `exposedFields` sont alimentés par les champs détectés (remplace les champs mockés du proto)
- Le bouton "Tester la connexion" est masqué quand un fichier GeoJSON est chargé

**Step 2 — Mapping** :
- Section "Champ pour le nom du noeud" en haut : dropdown des champs détectés (obligatoire)
- Table de mapping existante (proto) : alimentée par `exposedFields` + `getSchemaPropsForType(target_type)`
- Sections matching attributaire/spatial et périmètre restent comme dans le proto (câblées J7)

**Step 3** : non modifié

**Footer commun** :
- Bouton Précédent / Suivant pour naviguer
- Bouton "Sauvegarder & fermer"
- Bouton ▶ (icône Play, 36x36px) tout à droite. Visible si `format = 'GeoJSON'` ET `targetType` renseigné. Activé quand : fichier chargé + champ nom choisi + au moins un mapping de propriété défini. Post-J7 : sera aussi conditionné sur Step 3 patterns.

**Pendant l'exécution** :
- Bouton Play = spinner "..."
- À la fin : toast sonner (top-right) avec résumé, modale se ferme automatiquement
- Refetch stores sources + territoires

---

## Discipline de fidélité

Toute modification de ce composant doit :
1. Reproduire fidèlement l'état post-J8a validé
2. Être justifiée par une décision explicite
3. Donner lieu à une mise à jour de cette SPEC
