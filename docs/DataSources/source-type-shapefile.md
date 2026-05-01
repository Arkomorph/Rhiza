# Shapefile

## Identite

- **Nom** : ESRI Shapefile
- **Type** : format de fichier (multi-fichiers)
- **Organisme de spec** : ESRI -- spec proprietaire publiee, "ESRI Shapefile Technical Description", juillet 1998. Pas d'organisme de standardisation formel : ni OGC, ni ISO, ni IETF. ESRI a publie la spec pour permettre l'interoperabilite, mais ne l'a jamais soumise a un processus de normalisation.
- **Versions** : une seule. Le document de reference est le "ESRI Shapefile Technical Description" (juillet 1998), jamais revise. Il n'y a pas de version 2.
- **Statut de maturite** : **deprecie de facto** mais encore massivement utilise. ESRI recommande GeoPackage ou File Geodatabase depuis des annees. OGC ne l'a jamais standardise. Malgre cela, le Shapefile reste le format vectoriel le plus distribue sur les portails open data par pure inertie. En Suisse, les portails cantonaux et opendata.swiss le proposent encore systematiquement.

---

## Mecanisme de decouverte

### A. Connexion au service/fichier

Un "Shapefile" n'est pas un fichier unique. C'est un ensemble de **minimum 3 fichiers obligatoires** partageant le meme nom de base :

| Fichier | Role | Format |
|---|---|---|
| `.shp` | Geometries | Binaire proprietaire ESRI |
| `.shx` | Index spatial des geometries | Binaire (offsets dans le .shp) |
| `.dbf` | Attributs tabulaires | dBASE III/IV |

Fichiers optionnels courants :

| Fichier | Role | Notes |
|---|---|---|
| `.prj` | Definition du CRS | Format WKT (souvent WKT1). **Critique** : sans lui, le CRS est inconnu. |
| `.cpg` | Encodage du .dbf | Contient un nom d'encodage (ex: `UTF-8`, `1252`). Souvent absent. |
| `.sbn` / `.sbx` | Index spatial ESRI | Proprietaire, inutile pour Rhiza |
| `.xml` | Metadonnees ESRI | Souvent present, rarement utile |

**Distribution** : generalement un `.zip` contenant tous les fichiers. Les portails suisses (opendata.swiss, SITG, geo.vd.ch, swisstopo) distribuent quasi exclusivement des archives ZIP.

**Exemples reels suisses :**

```bash
# Recherche de Shapefiles sur opendata.swiss
https://opendata.swiss/en/dataset?res_format=SHAPEFILE

# swissBOUNDARIES3D (limites administratives) — distribue en Shapefile par swisstopo
https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissboundaries3d

# swissTLMRegio (modele paysager) — disponible en ESRI Shapefile
https://www.swisstopo.admin.ch/en/landscape-model-swisstlmregio

# Numeros de parcelles sur opendata.swiss (format SHP/ZIP)
https://opendata.swiss/fr/dataset/parzellennummern

# SITG Geneve — catalogue avec export Shapefile
https://sitg.ge.ch/

# geo.vd.ch — guichet cartographique vaudois, export SHP disponible
https://www.geo.vd.ch/
```

---

### B. Listing des couches disponibles

**Un Shapefile = une couche = une source Rhiza.** Il n'y a pas de mecanisme multi-couches.

Implementation Rhiza :
- `list_layers()` retourne toujours un `Vec` de **1 element**
- Le nom de la couche = nom du fichier `.shp` sans extension (ex: `batiments_fr.shp` -> `batiments_fr`)

**Cas particulier du ZIP multi-Shapefiles** : un `.zip` peut contenir plusieurs `.shp` (ex: swissBOUNDARIES3D contient `swissBOUNDARIES3D_1_5_TLM_HOHEITSGEBIET.shp`, `swissBOUNDARIES3D_1_5_TLM_BEZIRKSGEBIET.shp`, etc.). Chaque `.shp` dans le zip = une source Rhiza distincte. Rhiza doit lister tous les `.shp` presents dans l'archive.

---

### C. Description du schema d'une couche

Deux sources d'information a combiner :

**1. Header du .dbf (attributs) :**

Le header dBASE III/IV contient la definition des colonnes : nom (max 10 caracteres), type, taille, nombre de decimales.

Mapping types dBASE vers types universels Rhiza :

| Type dBASE | Code | Type universel | Notes |
|---|---|---|---|
| Character | `C` | string | Taille fixe, padde avec des espaces |
| Numeric | `N` | integer (si decimals=0) ou float (si decimals>0) | Stocke en ASCII dans le .dbf |
| Float | `F` | float | Equivalent a N avec decimales |
| Date | `D` | date | Format `YYYYMMDD`, pas de composante heure |
| Logical | `L` | boolean | `T`/`F`/`Y`/`N`/`?` |
| Memo | `M` | string | Requiert un fichier `.dbt` supplementaire |

**2. Header du .shp (geometrie) :**

Le header .shp contient le shape type (code numerique) :

| Code | Type | Type universel |
|---|---|---|
| 1 | Point | geometry (point) |
| 3 | PolyLine | geometry (linestring) |
| 5 | Polygon | geometry (polygon) |
| 8 | MultiPoint | geometry (multipoint) |
| 11/13/15 | PointZ/PolyLineZ/PolygonZ | geometry (point/linestring/polygon + Z) |

**3. Fichier .prj (CRS) :**

Format WKT (Well-Known Text), souvent WKT1. En Suisse, quasi toujours EPSG:2056 (CH1903+/LV95).

**Extrait concret — header .dbf d'un Shapefile cadastral suisse :**
```
Colonnes dBASE :
EGRID      C  14  0   → string
NUMMER     C  15  0   → string
GEMEINDE   N  10  0   → integer
GEMEINDE_N C  10  0   → string  (tronque! etait probablement GEMEINDE_NAME)
FLAECHENMA N  12  2   → float
KANTON     C   2  0   → string
```

Schema infere Rhiza :
```
EGRID        → string
NUMMER       → string
GEMEINDE     → integer
GEMEINDE_N   → string
FLAECHENMA   → float
KANTON       → string
geometry     → geometry (polygon)
CRS          → EPSG:2056
```

---

### D. Recuperation d'un echantillon de donnees

- Lire les N premiers records du `.dbf` (sequentiel) + les N premieres geometries du `.shp` (via les offsets du `.shx`)
- L'acces via `.shx` est plus efficace : chaque entree du `.shx` = offset + taille du record dans le `.shp`
- Acces sequentiel simple : lire les records dans l'ordre, s'arreter apres N

---

### E. Recuperation des donnees completes pour import

- Lecture sequentielle du `.shp` (geometries) + `.dbf` (attributs) en parallele, record par record. Le record i du `.dbf` correspond au record i du `.shp`.
- **Pas de pagination** : le fichier est lu integralement.
- **Streaming possible** : lecture record par record, memoire O(1). Le `.shx` fournit les offsets pour un acces aleatoire si necessaire.
- **Limite de taille** : `.shp` et `.dbf` plafonnes a **2 GB chacun** (pointeurs 32 bits dans le header, offsets en mots de 16 bits). Au-dela, le format est inutilisable.
- **Reprojection** : si le `.prj` indique un CRS different de la cible Rhiza, reprojeter a la volee pendant le streaming.

---

## Pieges et limitations connus

- **Multi-fichiers** : oublier le `.prj` = CRS inconnu. Oublier le `.cpg` = encodage inconnu. Oublier le `.shx` = pas d'index spatial. Certains portails distribuent des ZIP incomplets.
- **Encodage .dbf** : le defaut historique est **Windows-1252** ou **Latin-1**, PAS UTF-8. Le `.cpg` indique l'encodage mais est souvent absent. Les donnees suisses (accents francais, treemas allemands : Zurich, Geneve, Neuchatel) sont souvent corrompues si decodees en UTF-8 a tort.
- **Noms de colonnes tronques a 10 caracteres** : limitation dBASE III. `STRASSE_NAME` devient `STRASSE_NA`, `GEMEINDE_NAME` devient `GEMEINDE_N`. Perte d'information irrecuperable. Rhiza doit documenter les noms tronques dans les metadonnees de la source.
- **Pas de null natif** : les valeurs "vides" dans le .dbf sont des strings vides (`""`) ou des zeros (`0`). Impossible de distinguer `0` de null, `""` de null. Rhiza doit definir une convention (ex: string vide = null pour les champs texte).
- **Types limites** : pas de `datetime` (seulement `date` au format `YYYYMMDD`), pas d'entiers 64 bits, pas de listes/arrays, pas de JSON, pas de types complexes.
- **Geometries mixtes impossibles** : un Shapefile = un seul type de geometrie. On ne peut pas melanger Point et Polygon dans le meme fichier.
- **Limite 2 GB** par fichier (`.shp` et `.dbf` separement). Les gros jeux de donnees depassent cette limite.
- **CRS dans .prj** : format WKT1, parfois ambigu. Certains `.prj` sont ecrits par des logiciels differents avec des variantes WKT. La detection EPSG peut echouer.
- **Pas de standard formel** : variations entre implementations. Certains logiciels ecrivent des Shapefiles non conformes a la spec ESRI.
- **ZIP imbriques** : certains portails mettent le `.zip` Shapefile dans un autre `.zip`. Rhiza doit gerer la decompression recursive.
- **Coordonnees** : pas de metadata de precision dans le format. Les coordonnees sont des doubles IEEE 754.

---

## Interface backend Rust proposee

```rust
use async_trait::async_trait;

/// Shapefile : un ensemble de fichiers (.shp+.shx+.dbf) = une couche.
/// Un ZIP peut contenir plusieurs Shapefiles → plusieurs couches.
pub struct ShapefileSource;

#[async_trait]
impl SourceType for ShapefileSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Si endpoint est un .zip → dezipper dans un dossier temporaire
        //    Gerer les ZIP imbriques (ZIP dans ZIP)
        // 2. Si endpoint est un .shp → chercher les .shx, .dbf, .prj, .cpg adjacents
        // 3. Valider la presence des 3 fichiers obligatoires : .shp, .shx, .dbf
        // 4. Lire le .prj si present → parser le WKT pour identifier le CRS
        //    Heuristique de fallback : si pas de .prj, detecter EPSG:2056
        //    par les plages de coordonnees (X > 2'000'000, Y > 1'000'000)
        // 5. Lire le .cpg si present → stocker l'encodage
        //    Sinon, defaut = Windows-1252 (PAS UTF-8)
        // 6. Stocker : chemin, CRS, encodage, liste des .shp trouves
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // Si source = un seul .shp → Vec de 1 element
        // Si source = ZIP avec N .shp → Vec de N elements
        // name = nom du fichier .shp sans extension
        // geometry_type = lu depuis le header .shp
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // 1. Parser le header .dbf : colonnes (nom, type dBASE, taille, decimales)
        // 2. Mapper vers les types universels Rhiza
        // 3. Lire le header .shp : shape type → type de geometrie
        // 4. Lire le .prj → CRS
        // 5. Signaler les noms tronques (colonnes de 10 caracteres exactement)
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // Lire les n premiers records (.dbf + .shp via .shx)
        // Decoder les attributs avec l'encodage detecte (Windows-1252 par defaut)
        // Chaque feature = { properties: Map, geometry_wkt: String }
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Stream async record par record
        // Lire .shp et .dbf en parallele (record i = geometrie i + attributs i)
        // Decoder les attributs avec l'encodage detecte
        // Reprojeter si CRS ≠ cible Rhiza
        // Memoire O(1) : un record a la fois
    }
}
```

---

## Bibliotheques Rust pertinentes

| Crate | Version | Licence | Maintenance | Usage |
|---|---|---|---|---|
| `shapefile` | 0.6+ | MIT | Bonne | Lecture/ecriture Shapefile en Rust pur. Parse .shp, .shx, .dbf. **C'est LA solution.** |
| `dbase` | 0.5+ | MIT | Bonne (meme auteur que `shapefile`) | Lecture .dbf standalone. Utilise en interne par le crate `shapefile`. |
| `encoding_rs` | 0.8+ | MIT/Apache-2.0 | Excellente (Mozilla) | Conversion d'encodage pour les .dbf en Windows-1252/Latin-1 vers UTF-8 |
| `zip` | 2.x | MIT | Excellente | Extraction des archives .zip contenant les Shapefiles |
| `proj` | 0.27+ | MIT/Apache-2.0 | Bonne | Reprojection CRS (EPSG:2056 → 4326 et inversement). Bindings libproj. |
| `geo` | 0.28+ | MIT/Apache-2.0 | Bonne (georust) | Types geometriques Rust, interop avec le crate `shapefile` |

> **Note** : le crate `shapefile` de Thomas Montaigu est mature, en Rust pur (pas de binding C), et gere les .shp, .shx et .dbf de maniere integree. C'est le point de depart naturel. Le crate `dbase` du meme auteur est utilise en interne mais peut etre utile pour lire des .dbf isoles.

---

## Ecosysteme suisse

### Portails distribuant du Shapefile

| Portail | URL | Notes |
|---|---|---|
| opendata.swiss | [Datasets SHP](https://opendata.swiss/en/dataset?res_format=SHAPEFILE) | Filtre format=SHAPEFILE. Nombreux datasets cantonaux et federaux. |
| swisstopo | [swissBOUNDARIES3D](https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissboundaries3d) | Limites administratives, distribue en SHP + GeoPackage. |
| swisstopo | [swissTLMRegio](https://www.swisstopo.admin.ch/en/landscape-model-swisstlmregio) | Modele paysager, disponible en ESRI Shapefile. |
| SITG (Geneve) | [sitg.ge.ch](https://sitg.ge.ch/) | Export Shapefile disponible pour la plupart des couches |
| geo.vd.ch (Vaud) | [geo.vd.ch](https://www.geo.vd.ch/) | Export SHP disponible via le guichet cartographique |
| Portails cantonaux | FR, BE, ZH, etc. | Shapefile encore souvent propose a cote de GeoPackage |

### Particularites suisses

- **CRS** : quasi toujours **EPSG:2056** (CH1903+/LV95) dans le `.prj`. Rarement EPSG:21781 (CH1903/LV03, ancien systeme) pour les donnees historiques.
- **Encodage** : souvent **Windows-1252** ou **Latin-1**. Les donnees bilingues (Fribourg, Bienne, Valais) contiennent des accents et des treemas qui cassent si decodes en UTF-8. Le `.cpg` est souvent absent.
- **ZIP** : distribution standard en `.zip`. Certains portails (opendata.swiss) mettent un ZIP telechargeable contenant les 4-6 fichiers du Shapefile.
- **Noms tronques** : les donnees suisses multilangues souffrent particulierement de la limite a 10 caracteres (ex: `GEMEINDE_N` au lieu de `GEMEINDE_NAME`, `BEZIRK_NAM` au lieu de `BEZIRK_NAME`).
- **Depreciation progressive** : swisstopo propose de plus en plus GeoPackage et GeoJSON en parallele du Shapefile. La tendance est a l'abandon, mais le Shapefile reste le format le plus telecharge par inertie des utilisateurs.
