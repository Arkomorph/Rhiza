# GeoJSON

## Identité
- **Nom** : GeoJSON
- **Type** : format de fichier / téléchargement HTTP
- **Organisme de spec** : IETF — [RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946) (août 2016)
- **Versions** : GeoJSON 2008 (draft, spec communautaire geojson.org) → **RFC 7946** (2016, IETF, normative). Recommandation Rhiza : RFC 7946 uniquement.
- **Statut de maturité** : stable, adoption universelle. Format d'échange géo le plus courant sur le web.

---

## Mécanisme de découverte

### A. Connexion au service/fichier

Deux modes d'accès :
1. **URL HTTP** : `GET` sur une URL retournant du GeoJSON. Content-Type attendu : `application/geo+json` (RFC 7946 §12) ou `application/json` (fréquent en pratique).
2. **Fichier local** : upload ou chemin vers un fichier `.geojson` ou `.json`.

Pas d'authentification pour les portails publics suisses.

**Exemple réel suisse — geo.admin.ch REST API :**
```
https://api3.geo.admin.ch/rest/services/api/MapServer/ch.bfs.gebaeude_wohnungs_register/query?geometry=2578000,1183000,2579000,1184000&geometryType=esriGeometryEnvelope&spatialRelation=esriSpatialRelIntersects&outSR=2056&f=geojson
```

**Exemple — data.geo.admin.ch (STAC → téléchargement GeoJSON) :**
```
https://data.geo.admin.ch/ch.bfs.generalisierte-grenzen_agglomerationen_g1/geojson/ch.bfs.generalisierte-grenzen_agglomerationen_g1.geojson
```

**Exemple — opendata.swiss :**
Nombreux datasets proposent un téléchargement GeoJSON direct. Chercher dans le catalogue `https://opendata.swiss/` avec le filtre format=GeoJSON.

---

### B. Listing des couches disponibles

**Un fichier GeoJSON = une couche = une source Rhiza.**

Il n'y a pas de mécanisme de listing multi-couches dans le format. Un fichier contient une seule `FeatureCollection` (ou un seul `Feature` / `Geometry`, mais `FeatureCollection` est le cas standard).

Implémentation Rhiza :
- `list_layers()` retourne toujours un `Vec` de 1 élément
- Le nom de la couche = nom du fichier sans extension, ou identifiant de l'URL

---

### C. Description du schéma d'une couche

**GeoJSON n'a pas de schéma formel intégré.** Les propriétés (clé-valeur) sont libres et peuvent varier d'une feature à l'autre.

**Algorithme d'inférence Rhiza :**
1. Scanner les N premières features (N = 100 par défaut)
2. Collecter l'union de toutes les clés rencontrées dans `properties`
3. Pour chaque clé, inférer le type par majorité :

| Type JSON | Type universel | Notes |
|---|---|---|
| `string` | string | Défaut |
| `number` (entier) | integer | `value % 1 === 0` |
| `number` (décimal) | float | |
| `boolean` | boolean | |
| `null` | (ignoré pour l'inférence) | Ne contribue pas au type |
| `object` | string (sérialisé) | Nested — aplati ou sérialisé |
| `array` | string (sérialisé) | Idem |

4. Marquer les champs présents dans <90% des features comme `nullable`
5. Le champ `geometry` est toujours détecté automatiquement (type géométrique inféré depuis `geometry.type`)

**Extrait concret — feature d'un GeoJSON suisse (bâtiment RegBL) :**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [2578100.0, 1183900.0]
  },
  "properties": {
    "EGID": 190000001,
    "GDEKT": "FR",
    "GDEBFS": 2196,
    "GDENAME": "Fribourg",
    "STRNAME": "Rue de Morat",
    "DESSION": "1",
    "PLZ4": 1700,
    "GKAT": 1020,
    "GSTAT": 1004
  }
}
```

Schéma inféré :
```
EGID      → integer
GDEKT     → string
GDEBFS    → integer
GDENAME   → string
STRNAME   → string
DESSION   → string
PLZ4      → integer
GKAT      → integer
GSTAT     → integer
geometry  → geometry (point)
```

---

### D. Récupération d'un échantillon de données

- Lire les N premières features du tableau `features[]`
- **Petit fichier** (<50 MB) : charger en mémoire, prendre `features[0..n]`
- **Gros fichier** (>50 MB) : streaming JSON — parser le tableau `features` élément par élément, s'arrêter après N

Pas de mécanisme de pagination natif dans le format.

---

### E. Récupération des données complètes pour import

- **Chargement complet** : parser tout le fichier JSON en mémoire. Simple mais limité par la RAM.
- **Streaming JSON** : pour les fichiers volumineux, utiliser un parser streaming qui lit le tableau `features` sans charger l'intégralité en mémoire.
- **Taille max pratique** : ~500 MB en mémoire, au-delà streaming obligatoire.
- **Pas de pagination** : le format ne prévoit aucun mécanisme de pagination. Si la source est une API, la pagination dépend de l'API (pas du format GeoJSON).
- **Format de retour** : le fichier lui-même est la donnée. Pas de transformation nécessaire.

---

## Pièges et limitations connus

- **CRS : le piège majeur en Suisse.** RFC 7946 §4 impose WGS84 (EPSG:4326), coordonnées en [longitude, latitude]. Mais beaucoup de fichiers GeoJSON suisses sont en **EPSG:2056 (LV95)** — coordonnées ~[2'600'000, 1'200'000]. Rhiza **doit** détecter le CRS par heuristique sur les plages de valeurs et reprojeter si nécessaire.
- **Properties hétérogènes** : rien n'empêche deux features d'avoir des propriétés différentes. L'inférence de schéma doit gérer les clés manquantes et les types mixtes (ex: un champ parfois `string`, parfois `integer`).
- **Fichiers volumineux** : GeoJSON n'est pas conçu pour le streaming. Un fichier de 1 GB est un seul objet JSON — impossible à parser sans streaming spécialisé.
- **Encodage** : RFC 7946 §6 impose UTF-8. Certains fichiers legacy sont en Latin-1 → détecter et convertir.
- **Null geometries** : `"geometry": null` est valide (RFC 7946 §3.2). Rhiza doit les gérer sans planter.
- **Nested properties** : des objets ou tableaux dans `properties` ne sont pas rares (ex: `"adresse": {"rue": "...", "npa": 1700}`). Décider : aplatir ou sérialiser en string.
- **Coordonnées 3D** : `[lon, lat, altitude]` — la 3e coordonnée est parfois présente. L'ignorer ou la stocker selon le besoin.
- **Winding order** : RFC 7946 §3.1.6 impose la règle de la main droite (extérieur = anti-horaire). Beaucoup de fichiers ne la respectent pas. Être tolérant au parsing, normaliser en sortie.
- **Précision des coordonnées** : certains fichiers ont 15 décimales (inutile). Pas un bug, mais du bruit.

---

## Interface backend Rust proposée

```rust
use async_trait::async_trait;

/// GeoJSON : un fichier = une couche.
/// list_layers retourne toujours un seul élément.
pub struct GeoJsonSource {
    /// Nombre de features à scanner pour l'inférence de schéma
    schema_sample_size: usize,  // défaut: 100
}

#[async_trait]
impl SourceType for GeoJsonSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Si URL HTTP(S) → reqwest GET (streaming si gros)
        // 2. Si chemin local → ouvrir le fichier
        // 3. Valider : JSON valide avec "type": "FeatureCollection"
        // 4. Détecter le CRS par heuristique sur les premières coordonnées :
        //    - Valeurs > 100'000 → probablement EPSG:2056
        //    - Valeurs dans [-180,180] × [-90,90] → WGS84
        // 5. Stocker : source (URL/path), CRS détecté, feature_count si disponible
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // Toujours Vec de 1 élément
        // name = nom du fichier sans extension, ou slug de l'URL
        // feature_count = features.len() si le fichier est chargé
        // geometry_type = type dominant des géométries
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // Scanner les N premières features (schema_sample_size)
        // Union des clés de properties
        // Inférence de type par majorité
        // Marquer les champs nullable (<90% de présence)
        // Détecter le type de géométrie
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // Retourner les n premières features
        // Chaque feature = { properties: Map, geometry_wkt: String }
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Stream async sur toutes les features
        // Petit fichier : chargement mémoire + itération
        // Gros fichier : streaming JSON (parser le tableau features)
        // Reprojeter si CRS ≠ cible Rhiza
    }
}
```

---

## Bibliothèques Rust pertinentes

| Crate | Version | Licence | Maintenance | Usage |
|---|---|---|---|---|
| `geojson` | 0.24+ | MIT/Apache-2.0 | Bonne (georust) | Parsing/sérialisation GeoJSON. Struct `FeatureCollection`, `Feature`, `Geometry`. |
| `serde_json` | 1.x | MIT/Apache-2.0 | Excellente | Parsing JSON générique, accès aux `properties` comme `Value` |
| `reqwest` | 0.12+ | MIT/Apache-2.0 | Excellente | HTTP client async pour fetch d'URLs |
| `proj` | 0.27+ | MIT/Apache-2.0 | Bonne | Reprojection CRS (EPSG:2056 → 4326 et inversement). Bindings libproj. |
| `geo` | 0.28+ | MIT/Apache-2.0 | Bonne (georust) | Types géométriques Rust, interop avec le crate `geojson` via `TryInto<geo::Geometry>` |
| `tokio` | 1.x | MIT | Excellente | Runtime async, streaming fichiers |

> **Note** : le crate `geojson` de georust est mature et bien intégré avec `geo` et `proj`. C'est la base naturelle pour l'implémentation Rhiza.

---

## Écosystème suisse

### Portails exposant du GeoJSON

| Portail | Type | Notes |
|---|---|---|
| geo.admin.ch (REST API) | API en ligne | Paramètre `f=geojson`. Retourne en **EPSG:2056** par défaut (violation RFC 7946). |
| data.geo.admin.ch | Téléchargement | Certains datasets en GeoJSON statique |
| opendata.swiss | Catalogue | Filtre format=GeoJSON, liens directs vers fichiers |
| SITG (Genève) | API + téléchargement | Export GeoJSON disponible |
| Portails cantonaux divers | Variable | FR, VD, BE, ZH exposent parfois du GeoJSON |

### Particularité majeure : CRS 2056

L'API geo.admin.ch retourne du GeoJSON en EPSG:2056 (LV95) par défaut, pas en WGS84. C'est une **violation de RFC 7946** mais c'est le standard de facto suisse.

Détection heuristique dans Rhiza :
```
Si première coordonnée X > 2'000'000 et Y > 1'000'000 → EPSG:2056 (LV95)
Si première coordonnée X ∈ [5, 11] et Y ∈ [45, 48] → EPSG:4326 (WGS84)
```

### Exemples réels d'URLs

```bash
# Bâtiments RegBL via geo.admin.ch (EPSG:2056, GeoJSON)
https://api3.geo.admin.ch/rest/services/api/MapServer/ch.bfs.gebaeude_wohnungs_register/query?geometry=2578000,1183000,2579000,1184000&geometryType=esriGeometryEnvelope&f=geojson

# Limites communales généralisées (téléchargement statique)
https://data.geo.admin.ch/ch.bfs.generalisierte-grenzen_agglomerationen_g1/geojson/

# Recherche sur opendata.swiss
https://opendata.swiss/fr/dataset?res_format=GeoJSON
```
