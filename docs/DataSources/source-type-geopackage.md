# GeoPackage

## Identité
- **Nom** : GeoPackage (.gpkg)
- **Type** : format de fichier (SQLite)
- **Organisme de spec** : OGC — [OGC GeoPackage Encoding Standard (OGC 12-128r18)](https://www.ogc.org/standard/geopackage/)
- **Versions** : 1.0 (2014), 1.1 (2015), 1.2 (2017), 1.2.1 (2018), 1.3 (2021), 1.4 (2023). Recommandation : **1.2.1+** (la plus déployée, supportée par tous les outils majeurs).
- **Statut de maturité** : stable, adoption croissante, remplaçant désigné du Shapefile. Supporté nativement par QGIS, ArcGIS, GDAL, MapLibre, et la plupart des outils SIG.

---

## Mécanisme de découverte

### A. Connexion au service/fichier

Un fichier `.gpkg` est une base SQLite avec des tables système prédéfinies par la spec OGC. Deux modes d'accès :

1. **Chemin local** : ouvrir directement avec un driver SQLite. Vérifier :
   - La signature SQLite dans le header du fichier (`SQLite format 3\000` — 16 premiers octets)
   - L'existence de la table `gpkg_contents` (discriminant vs. une base SQLite quelconque)
2. **URL HTTP** : téléchargement complet nécessaire. SQLite ne supporte pas le streaming HTTP natif (lecture aléatoire requise). Utiliser `reqwest` pour télécharger dans un fichier temporaire, puis ouvrir localement.

**Sources suisses concrètes :**
- **swisstopo — swissBOUNDARIES3D** : disponible en GeoPackage sur [swisstopo.admin.ch](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d) et [opendata.swiss](https://opendata.swiss/en/dataset/swissboundaries3d). Contient les limites administratives (communes, districts, cantons, pays).
- **opendata.swiss** : filtrer par format GeoPackage — ex. [Sachplan Ubertragungsleitungen (SUL)](https://opendata.swiss/en/dataset/sachplan-ubertragungsleitungen-sul/resource/1eb2473b-145a-43cb-99ee-2ac91add64ad)
- **data.geo.admin.ch** : [catalogue STAC](https://data.geo.admin.ch) — certains datasets proposent le téléchargement GeoPackage
- **ili2gpkg** : tout fichier INTERLIS cantonal peut etre converti en .gpkg via [ili2gpkg](http://www.eisenhutinformatik.ch/interlis/ili2gpkg/). Passerelle naturelle pour les données cadastrales.

---

### B. Listing des couches disponibles

La table système `gpkg_contents` liste toutes les couches du fichier :

```sql
SELECT table_name, data_type, identifier, description, srs_id,
       min_x, min_y, max_x, max_y
FROM gpkg_contents
WHERE data_type IN ('features', 'tiles', 'attributes');
```

- `data_type = 'features'` : couches vectorielles (interet principal Rhiza)
- `data_type = 'attributes'` : tables non spatiales (tables de jointure, metadata)
- `data_type = 'tiles'` : tuiles raster (hors scope Rhiza pour l'instant)

**Chaque ligne = une source Rhiza.** Un GeoPackage contenant 15 tables produit 15 sources distinctes.

**Extrait concret — swissBOUNDARIES3D :**

| table_name | data_type | identifier | srs_id | min_x | min_y | max_x | max_y |
|---|---|---|---|---|---|---|---|
| tlm_hoheitsgebiet | features | Limites nationales | 2056 | 2485000 | 1074000 | 2834000 | 1296000 |
| tlm_kantonsgebiet | features | Limites cantonales | 2056 | 2485000 | 1074000 | 2834000 | 1296000 |
| tlm_bezirksgebiet | features | Limites de districts | 2056 | 2485000 | 1074000 | 2834000 | 1296000 |
| tlm_hoheitsgebiet_line | features | Lignes frontalieres | 2056 | 2485000 | 1074000 | 2834000 | 1296000 |

---

### C. Description du schema d'une couche

Deux requetes combinées :

**1. Colonnes de la table :**
```sql
PRAGMA table_info('tlm_kantonsgebiet');
```

Résultat :

| cid | name | type | notnull | dflt_value | pk |
|---|---|---|---|---|---|
| 0 | fid | INTEGER | 1 | | 1 |
| 1 | geom | BLOB | 0 | | 0 |
| 2 | kantonsnummer | INTEGER | 0 | | 0 |
| 3 | name | TEXT | 0 | | 0 |
| 4 | kantonsflaeche | REAL | 0 | | 0 |
| 5 | see_flaeche | REAL | 0 | | 0 |
| 6 | einwohnerzahl | INTEGER | 0 | | 0 |

**2. Colonne geometrie :**
```sql
SELECT column_name, geometry_type_name, srs_id, z, m
FROM gpkg_geometry_columns
WHERE table_name = 'tlm_kantonsgebiet';
```

Résultat :

| column_name | geometry_type_name | srs_id | z | m |
|---|---|---|---|---|
| geom | MULTIPOLYGON | 2056 | 0 | 0 |

**Mapping types SQLite vers types universels Rhiza :**

| Type SQLite / GeoPackage | Type universel Rhiza | Notes |
|---|---|---|
| TEXT | string | |
| INTEGER | integer | Inclut les booléens SQLite (0/1) |
| REAL | float | |
| BLOB (colonne géométrie) | geometry | Référencé dans `gpkg_geometry_columns` |
| BOOLEAN | boolean | Extension SQLite, souvent stocké comme INTEGER 0/1 |
| DATE | date | Format ISO 8601 `yyyy-mm-dd` |
| DATETIME | date | Format ISO 8601 `yyyy-mm-ddThh:mm:ssZ` |

**Détection booléen vs. entier** : si le type déclaré est `BOOLEAN` ou si toutes les valeurs sont 0/1 sur un échantillon, marquer comme boolean.

---

### D. Récupération d'un échantillon

```sql
SELECT * FROM tlm_kantonsgebiet LIMIT 5;
```

**Décodage des géométries** : les géométries GeoPackage ne sont **pas** du WKB standard. Elles sont en **GeoPackage Binary** (spec OGC 12-128r18 §2.1.3) :

```
[GP header] [WKB standard]
```

Structure du header GP :
1. **Magic** : 2 octets `0x4750` ("GP")
2. **Version** : 1 octet
3. **Flags** : 1 octet (byte order, envelope type, empty flag)
4. **SRS ID** : 4 octets (int32)
5. **Envelope** : 0, 32, 48 ou 64 octets selon le type d'envelope (flags bits 1-3)
6. **WKB standard** : le reste du BLOB

Pour extraire la géométrie : parser le header GP, sauter au WKB, puis décoder le WKB normalement.

---

### E. Récupération complète

```sql
SELECT * FROM tlm_kantonsgebiet;
```

- **Pas de pagination nécessaire** : accès direct SQLite, lecture séquentielle des rows.
- **Streaming** : itérer sur les rows SQLite un par un (`rusqlite::Statement::query_map`), pas de chargement mémoire complet.
- **Filtres SQL** : `WHERE` classique + requêtes spatiales si l'extension RTree est activée :
  ```sql
  SELECT * FROM tlm_kantonsgebiet AS k
  WHERE k.fid IN (
      SELECT id FROM rtree_tlm_kantonsgebiet_geom
      WHERE minx <= 2580000 AND maxx >= 2575000
        AND miny <= 1185000 AND maxy >= 1180000
  );
  ```
  (Bounding box autour de Fribourg en EPSG:2056)

---

## Pieges et limitations connus

- **GeoPackage Binary vs WKB** : le BLOB géométrie contient un header GP avant le WKB standard. Ne pas passer le BLOB brut a un parser WKB — extraire d'abord le WKB (offset variable selon l'envelope). C'est le piege n1 en implémentation.
- **Extensions optionnelles** : RTree spatial index (`gpkg_rtree_index`), WebP tiles, related tables (`gpkg_related_tables`). Vérifier `gpkg_extensions` pour savoir lesquelles sont actives. Ne pas supposer qu'un RTree existe.
- **Fichiers volumineux** : un .gpkg peut dépasser 1 GB (ex. swissTLM3D complet). Prévoir un indicateur de progression pour `fetch_all`.
- **CRS** : la table `gpkg_spatial_ref_sys` contient les définitions CRS. En Suisse, **EPSG:2056** (MN95 / LV95) est quasi-systématique. Vérifier le `srs_id` de chaque couche.
- **SQLite locking** : un seul writer a la fois. Si Rhiza importe pendant qu'un autre processus écrit, risque de `SQLITE_BUSY`. Ouvrir en read-only (`SQLITE_OPEN_READONLY`).
- **Encodage** : UTF-8 obligatoire (spec SQLite + spec GeoPackage). Pas de problème d'encodage contrairement aux CSV/Shapefiles.
- **Géométries Z/M** : les champs `z` et `m` dans `gpkg_geometry_columns` indiquent si la couche contient des coordonnées 3D (altitude) ou des mesures. swissBOUNDARIES3D est 2D, mais swissTLM3D contient du Z. Le parser WKB doit gérer les variantes Z/M/ZM.
- **Clé primaire** : la spec impose une colonne `fid` INTEGER PRIMARY KEY AUTOINCREMENT. Mais certains fichiers produits par des outils tiers (QGIS, ili2gpkg) peuvent utiliser un autre nom. Lire `PRAGMA table_info` pour identifier la PK.
- **Tables vides** : une couche listée dans `gpkg_contents` peut ne contenir aucune feature. Gérer le cas `COUNT(*) = 0`.

---

## Interface backend Rust proposée

```rust
use async_trait::async_trait;

pub struct GeoPackageSource {
    /// Chemin vers le fichier .gpkg (local ou fichier temporaire après téléchargement)
    file_path: PathBuf,
    /// Ouverture en read-only (défaut : true)
    read_only: bool,
}

#[async_trait]
impl SourceType for GeoPackageSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Si URL HTTP(S) → télécharger le fichier complet (reqwest)
        //    Stocker dans un fichier temporaire
        // 2. Si chemin local → vérifier l'existence
        // 3. Ouvrir avec rusqlite::Connection::open_with_flags(SQLITE_OPEN_READONLY)
        // 4. Vérifier : SELECT name FROM sqlite_master
        //    WHERE type='table' AND name='gpkg_contents'
        //    → si absent, ce n'est pas un GeoPackage valide
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // SELECT table_name, data_type, identifier, description,
        //        srs_id, min_x, min_y, max_x, max_y
        // FROM gpkg_contents
        // WHERE data_type = 'features'
        //
        // Pour chaque row → LayerInfo {
        //   id: table_name,
        //   name: identifier (ou table_name si null),
        //   description,
        //   srs_id,
        //   bbox: (min_x, min_y, max_x, max_y),
        //   feature_count: SELECT COUNT(*) FROM {table_name}
        // }
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // 1. PRAGMA table_info('{layer_id}') → colonnes + types SQLite
        // 2. SELECT * FROM gpkg_geometry_columns
        //    WHERE table_name = '{layer_id}'
        //    → geometry_type_name, srs_id, z, m
        // 3. Mapper types SQLite → types universels Rhiza
        // 4. Retourner : Vec<FieldInfo { name, type, geometry_type, srs_id }>
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // SELECT * FROM {layer_id} LIMIT {n}
        // Pour chaque row :
        //   - Colonnes non-géo → valeurs directes
        //   - Colonne géo → décoder GP Binary header, extraire WKB,
        //     convertir en WKT pour l'affichage
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // SELECT * FROM {layer_id}
        // Itérateur sur les rows (rusqlite::Rows)
        // Pour chaque row :
        //   - Décoder GP Binary → WKB → géométrie
        //   - Mapper les colonnes vers les types Rhiza
        // Streaming : pas de Vec complet en mémoire
    }
}
```

---

## Bibliothèques Rust pertinentes

| Crate | Version | Licence | Maintenance | Usage |
|---|---|---|---|---|
| `rusqlite` | 0.31+ | MIT | Excellente | Accès SQLite natif, mature, API synchrone. Base naturelle pour lire un .gpkg. |
| `gdal` | 0.17+ | MIT | Bonne | Bindings GDAL, supporte GeoPackage nativement (lecture/écriture). Dépendance lourde (libgdal C). Utile si on veut éviter le parsing GP Binary maison. |
| `geo` | 0.28+ | MIT/Apache-2.0 | Excellente | Types géométriques Rust (Point, Polygon, etc.) et opérations spatiales. |
| `wkb` | 0.7+ | MIT | Correcte | Parsing WKB → types `geo`. Attention : ne gère pas le header GP, seulement le WKB pur. |
| `geozero` | 0.13+ | MIT/Apache-2.0 | Bonne | Lecture GeoPackage Binary directe (gpkg feature), alternative à gdal sans dépendance C. |
| `proj` | 0.27+ | MIT/Apache-2.0 | Bonne | Reprojection CRS (EPSG:2056 ↔ 4326). Dépendance sur libproj C. |
| `reqwest` | 0.12+ | MIT/Apache-2.0 | Excellente | Téléchargement HTTP async si le .gpkg est distant. |

**Recommandation** : `rusqlite` + parsing GP Binary maison (header simple, bien documenté dans la spec OGC) + `wkb` pour le WKB standard. Éviter `gdal` sauf si on l'utilise déjà ailleurs dans le projet — la dépendance C est lourde. `geozero` est une alternative intéressante qui parse le GP Binary nativement sans dépendance C.

---

## Écosystème suisse

### Sources GeoPackage

| Source | URL | Contenu |
|---|---|---|
| swisstopo — swissBOUNDARIES3D | [swisstopo.admin.ch](https://www.swisstopo.admin.ch/en/landscape-model-swissboundaries3d) | Limites administratives CH/LI. GeoPackage disponible au téléchargement. |
| swisstopo — swissTLMRegio | [swisstopo.admin.ch](https://www.swisstopo.admin.ch/en/landscape-model-swisstlmregio) | Modèle topographique régional. |
| opendata.swiss | [opendata.swiss](https://opendata.swiss/en/dataset?res_format=GPKG) | Filtrer par format GPKG. Datasets fédéraux divers. |
| data.geo.admin.ch | [data.geo.admin.ch](https://data.geo.admin.ch) | Catalogue STAC, certains datasets en GeoPackage. |
| Portails cantonaux | Variable | Certains cantons proposent des exports GeoPackage (souvent via ili2gpkg). |

### Passerelle INTERLIS → GeoPackage

[ili2gpkg](https://www.interlis.ch/en/downloads/ili2db) convertit les fichiers de transfert INTERLIS (.xtf) en GeoPackage. C'est la passerelle standard pour les données cadastrales et les modèles de données cantonaux suisses. Toute donnée disponible en INTERLIS peut etre convertie en .gpkg, puis ingérée par Rhiza.

```bash
# Exemple : convertir un transfert INTERLIS en GeoPackage
java -jar ili2gpkg.jar --import --dbfile output.gpkg input.xtf
```

### Particularités suisses

| Aspect | Valeur typique |
|---|---|
| CRS | **EPSG:2056** (MN95 / LV95) — quasi-systématique |
| Géométries 3D | Présentes dans swissTLM3D (coordonnées Z = altitude MN02) |
| Encodage | UTF-8 (garanti par la spec GeoPackage) |
| Noms de tables | Souvent en allemand (`kantonsgebiet`, `hoheitsgebiet`, `bezirksgebiet`) |
| Extensions | RTree spatial index généralement activé dans les fichiers swisstopo |

### Avantages du GeoPackage pour Rhiza

- **Un fichier = une base complète** : pas de fichiers satellites (.dbf, .shx, .prj comme le Shapefile)
- **Typage fort** : types SQL déclarés, pas d'inférence nécessaire (contrairement au CSV)
- **Requêtes SQL** : filtrage spatial et attributaire directement dans le fichier, sans import
- **Multi-couches** : un seul fichier peut contenir toutes les couches d'un dataset
- **Standard OGC** : interopérabilité garantie avec l'écosystème géospatial
