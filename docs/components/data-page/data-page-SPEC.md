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
- "Synchronisables (0)" — disabled Sprint 2, activé quand patterns configurés (J7)
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
| Actions | 90px | Pencil (actif) + Trash (actif) |

### Actions

- **Pencil** (accent) : ouvre le SourceStepper en mode edit sur Step 1. Actif pour toutes les sources non archivées.
- **Trash** (rouge) : archive la source (modale de confirmation).
- **Play** : retiré de la DataTable pour Sprint 2. L'exécution passe par le SourceStepper (Pencil → charger fichier → ▶).

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

## SourceStepper (modale unifiée)

Une seule modale pour création, configuration ET exécution. Pencil ouvre en mode edit, "+ Nouvelle source" ouvre en mode create.

### Step 1 — Source

- Nom, format, portail, type cible (dropdown schéma)
- **GeoJSON fichier** : bouton "Parcourir..." = vrai `<input type="file">`
  - FileReader parse le JSON, vérifie FeatureCollection
  - Extrait les champs de la première feature + nombre total
  - Indicateur "{N} features détectées" (vert quand fichier chargé)
  - À la réouverture : bouton affiche "Re-charger {nom}" si fichier non rechargé, hint "Fichier requis pour exécuter"
  - Le fichier binaire ne peut pas être persisté (sécurité navigateur) — seul le nom est mémorisé
- **Autres formats** : endpoint URL + "Tester la connexion" / "Découvrir les couches" (proto)

### Step 2 — Mapping

- **Champ nom** (en haut) : dropdown des champs détectés. Obligatoire. Détermine `metier.territoires.nom`.
- **Type cible** : rappel lecture seule (badge, défini en Step 1)
- **Table de mapping** : tous les champs source (sauf geometry) × dropdown propriétés Rhiza cible
  - La propriété "Nom" est exclue du dropdown cible (déjà nourrie par l'encadré dédié)
  - Tous les champs source restent visibles (jamais filtrés)
- Sections matching attributaire/spatial + périmètre (proto, câblées J7)

### Step 3 — Patterns

Non modifié Sprint 2.

### Footer commun

- Bouton Précédent / Suivant pour naviguer
- Bouton "Sauvegarder & fermer" : persiste les champs source via PATCH + `draft_config` JSONB en base
- Bouton ▶ (icône Play, 36x36px) tout à droite :
  - Toujours visible (create et edit)
  - Désactivé tant que : fichier non chargé OU champ nom non choisi OU type cible absent
  - En mode create : sauvegarde la source en base avant d'exécuter
  - Pendant l'exécution : spinner "..."
  - À la fin : toast sonner, modale se ferme, refetch stores sources + territoires

---

## Persistance

- **Champs source** (nom, format, portail, target_type) : persistés en base via PATCH `/sources/:id`
- **Configuration stepper** (mapping, patterns, execNomField, lastFilePath, exposedFields, etc.) : persistés dans `config.sources.draft_config` (JSONB). Survit au hard refresh.
- **Fichier binaire** : non persistable (sécurité navigateur). Rechargement requis à chaque session.
- **State local** (`sourceConfig` dans App.jsx) : cache volatile, prioritaire sur `draft_config` pendant la session.

---

## Discipline de fidélité

Toute modification de ce composant doit :
1. Reproduire fidèlement l'état post-J8b validé
2. Être justifiée par une décision explicite
3. Donner lieu à une mise à jour de cette SPEC
