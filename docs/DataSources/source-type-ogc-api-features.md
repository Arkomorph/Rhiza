# OGC API Features

## Identite

- **Nom** : OGC API Features (anciennement WFS 3.0)
- **Type** : service en ligne (API REST/JSON)
- **Organisme de spec** : OGC — [OGC API - Features - Part 1: Core (OGC 17-069r4)](https://docs.ogc.org/is/17-069r4/17-069r4.html), [Part 2: CRS (OGC 18-058r1)](https://docs.ogc.org/is/18-058r1/18-058r1.html)
- **Versions** : Part 1 v1.0 (2019), Part 2 v1.0 (2022). Parts 3 (Filtering, OGC 19-079r2) et 4 (Create/Replace/Update/Delete) en draft.
- **Statut de maturite** : stable (Part 1+2), successeur officiel de WFS. Adoption croissante mais encore minoritaire face a WFS dans l'ecosysteme suisse.
- **Difference fondamentale avec WFS** : REST + JSON au lieu de SOAP/XML. URLs lisibles (`/collections/{id}/items`) au lieu de parametres KVP (`REQUEST=GetFeature&TYPENAME=...`). GeoJSON comme format par defaut au lieu de GML. Navigation par liens hypermedia (HATEOAS) au lieu de GetCapabilities monolithique.

---

## Mecanisme de decouverte

### A. Connexion au service

URL de base = "landing page" du service. Reponse JSON avec liens vers les ressources. Pas de GetCapabilities — navigation par liens hypermedia (HATEOAS).

Content-Type : `application/json` pour les metadonnees, `application/geo+json` pour les features.

**Endpoints standards :**

| Endpoint | Description |
|---|---|
| `GET /` | Landing page — point d'entree, liens vers les ressources |
| `GET /conformance` | Classes de conformite supportees par le serveur |
| `GET /collections` | Liste des collections (= couches) |
| `GET /collections/{id}` | Metadonnees d'une collection specifique |
| `GET /collections/{id}/items` | Features (GeoJSON FeatureCollection) |
| `GET /collections/{id}/items/{featureId}` | Une feature individuelle |

**Comparaison directe avec WFS :**

| Operation WFS | Equivalent OGC API Features |
|---|---|
| `GetCapabilities` | `GET /` + `GET /conformance` + `GET /collections` |
| `DescribeFeatureType` | `GET /collections/{id}/schema` (extension, pas Part 1) |
| `GetFeature` | `GET /collections/{id}/items` |
| Pas d'equivalent | `GET /collections/{id}/items/{featureId}` (acces direct) |

**Exemple suisse — geodienste.ch (cadastre, depuis v4.0.2 fevrier 2025) :**
```
https://www.geodienste.ch/db/avc_0/fra/ogcapi
```

**Exemple — data.geo.admin.ch (STAC API, superset d'OGC API Features Part 1) :**
```
https://data.geo.admin.ch/api/stac/v1/
```

> **Attention** : geo.admin.ch (api3.geo.admin.ch) utilise toujours une **API REST proprietaire**, pas OGC API Features standard. Le STAC API sur data.geo.admin.ch est un superset d'OGC API Features Part 1 Core, mais expose des assets (fichiers) plutot que des features vectorielles interrogeables. Pour les features vectorielles via OGC API Features, geodienste.ch est la reference intercantonal depuis fevrier 2025.

---

### B. Listing des couches disponibles

`GET /collections` retourne un objet JSON avec un tableau `collections`. Chaque collection = **une source Rhiza**.

Attributs par collection : `id`, `title`, `description`, `extent` (spatial + temporal), `crs` (si Part 2), `links`.

**Extrait concret (realiste, inspire de geodienste.ch) :**
```json
{
  "collections": [
    {
      "id": "parcelle",
      "title": "Parcelles cadastrales",
      "description": "Limites des parcelles du cadastre - mensuration officielle",
      "extent": {
        "spatial": {
          "bbox": [[5.95, 45.82, 10.49, 47.81]],
          "crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"
        },
        "temporal": {
          "interval": [["2020-01-01T00:00:00Z", null]]
        }
      },
      "crs": [
        "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
        "http://www.opengis.net/def/crs/EPSG/0/2056"
      ],
      "links": [
        {"rel": "self", "href": "https://geodienste.ch/db/avc_0/fra/ogcapi/collections/parcelle"},
        {"rel": "items", "href": "https://geodienste.ch/db/avc_0/fra/ogcapi/collections/parcelle/items"}
      ]
    },
    {
      "id": "batiment",
      "title": "Batiments",
      "description": "Emprises des batiments - mensuration officielle",
      "extent": {
        "spatial": {
          "bbox": [[5.95, 45.82, 10.49, 47.81]]
        }
      },
      "links": [
        {"rel": "items", "href": "https://geodienste.ch/db/avc_0/fra/ogcapi/collections/batiment/items"}
      ]
    }
  ],
  "links": [
    {"rel": "self", "href": "https://geodienste.ch/db/avc_0/fra/ogcapi/collections"}
  ]
}
```

Un endpoint geodienste.ch qui expose 20 collections = 20 sources Rhiza distinctes.

---

### C. Description du schema d'une couche

OGC API Features Part 1 **ne definit PAS de schema formel obligatoire**. C'est une difference majeure avec WFS ou `DescribeFeatureType` retourne un XSD precis.

**Strategies par ordre de preference :**

1. **`GET /collections/{id}/schema`** — extension non standard (Part 1), mais certains serveurs l'exposent (JSON Schema). A tester en premier.
2. **Part 5 (draft)** — definira JSON Schema pour les features. Pas encore standardise.
3. **Inference depuis un echantillon** — recuperer N features et deduire le schema depuis les proprietes GeoJSON. Meme logique que pour le type source GeoJSON.

**Mapping types JSON → types universels :**

| Type JSON (infere) | Type universel |
|---|---|
| `string` | string |
| `number` (entier) | integer |
| `number` (decimal) | float |
| `boolean` | boolean |
| `string` (pattern ISO 8601) | date |
| Objet `geometry` | geometry |
| `array` | array |
| `string` (valeurs repetitives, cardinalite faible) | enum (candidat) |

> **Comparaison WFS** : WFS retourne un XSD formel via DescribeFeatureType — types connus avant toute requete de donnees. OGC API Features necessite souvent une inference, ce qui est moins fiable mais plus simple a implementer.

---

### D. Recuperation d'un echantillon

`GET /collections/{id}/items?limit=N`

Reponse : GeoJSON FeatureCollection.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "parcelle.12345",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[7.157, 46.806], [7.158, 46.806], [7.158, 46.807], [7.157, 46.807], [7.157, 46.806]]]
      },
      "properties": {
        "IDENTDN": "FR",
        "NUMERO": "1234",
        "EGRID": "CH123456789012",
        "SURFACE": 450.5
      }
    }
  ],
  "numberReturned": 1,
  "numberMatched": 54321
}
```

- `limit` est le parametre standard (pas `count` comme en WFS 2.0, ni `maxFeatures` comme en WFS 1.x)
- `numberReturned` et `numberMatched` sont optionnels dans la reponse

---

### E. Recuperation complete

Pagination par liens `next` dans la reponse (HATEOAS) — **pas par `startIndex` comme en WFS 2.0** :

```json
{
  "type": "FeatureCollection",
  "features": ["..."],
  "links": [
    {"rel": "next", "href": "https://geodienste.ch/db/avc_0/fra/ogcapi/collections/parcelle/items?offset=100&limit=100"}
  ],
  "numberReturned": 100,
  "numberMatched": 5432
}
```

**Algorithme** : suivre le lien `next` jusqu'a ce qu'il n'y en ait plus. Ne pas construire les URLs de pagination soi-meme — utiliser le lien fourni par le serveur.

**Filtres standards :**

| Parametre | Description |
|---|---|
| `bbox` | Filtre spatial : `bbox=7.1,46.8,7.2,46.9` |
| `datetime` | Filtre temporel ISO 8601 : `datetime=2024-01-01/2024-12-31` |
| `limit` | Nombre max de features par page |
| `crs` | CRS de la reponse (Part 2) : `crs=http://www.opengis.net/def/crs/EPSG/0/2056` |

**Filtres avances (Part 3 — draft) :**
- Filtre CQL2 sur les proprietes
- Pas encore largement deploye

**Comparaison WFS** : WFS utilise des filtres XML (FES 2.0) verbeux. OGC API Features utilise des parametres URL simples (`bbox`, `datetime`) et CQL2 pour le filtrage avance. Beaucoup plus simple a construire programmatiquement.

---

## Pieges et limitations connus

- **Adoption limitee en Suisse** : geodienste.ch a active OGC API Features en fevrier 2025 (v4.0.2), mais beaucoup de portails cantonaux sont encore en WFS 2.0 uniquement. Le SITG Geneve ne semble pas encore exposer d'OGC API Features standard.
- **Pas de schema formel garanti** (Part 1) : inference necessaire, contrairement a WFS/DescribeFeatureType. Risque de types mal detectes.
- **CRS par defaut = CRS84, pas EPSG:4326** : CRS84 = lon/lat (ordre x,y). EPSG:4326 = lat/lon (ordre y,x). Meme datum WGS84, mais ordre des axes inverse. Source de bugs subtils. Pour EPSG:2056, utiliser le parametre `crs` (Part 2).
- **`limit` max impose par le serveur** : souvent 1000-10000. Le client ne peut pas demander plus. Paginer obligatoirement.
- **Pagination non standardisee dans l'implementation** : Part 1 dit "suivre le lien `next`", mais les serveurs implementent differemment (offset, curseur opaque, token). Ne jamais construire l'URL soi-meme — toujours utiliser le `href` du lien `next`.
- **CORS** : generalement mieux gere que WFS (API moderne), mais pas garanti. Pas un probleme pour un backend Rust.
- **Formats** : GeoJSON par defaut. Certains serveurs supportent aussi GML, HTML, FlatGeobuf. Toujours negocier via `Accept` header ou parametre `f`.
- **Temporal extent** : format ISO 8601, peut etre `null` pour les collections sans dimension temporelle.
- **Encodage des CRS dans les URLs** : les identifiants CRS sont des URIs complets (`http://www.opengis.net/def/crs/EPSG/0/2056`), pas juste `EPSG:2056`. A encoder correctement.
- **data.geo.admin.ch STAC vs OGC API Features** : le STAC API de swisstopo est un superset d'OGC API Features Part 1, mais expose des assets (fichiers XTF, GeoPackage, etc.), pas des features vectorielles interrogeables individuellement. Ne pas confondre avec un vrai service OGC API Features de donnees vectorielles.

---

## Interface backend Rust proposee

```rust
use async_trait::async_trait;

pub struct OgcApiFeaturesSource {
    /// Classes de conformite detectees via /conformance
    conformance: Vec<String>,
    /// Part 2 CRS supportee ?
    supports_crs: bool,
}

#[async_trait]
impl SourceType for OgcApiFeaturesSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. GET / (landing page) — verifier que c'est bien un service OGC API Features
        // 2. Suivre le lien rel="conformance" → GET /conformance
        // 3. Parser les classes de conformite :
        //    - "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/core" → Part 1
        //    - "http://www.opengis.net/spec/ogcapi-features-1/1.0/conf/geojson" → GeoJSON
        //    - "http://www.opengis.net/spec/ogcapi-features-2/1.0/conf/crs" → Part 2 CRS
        // 4. Stocker les liens et les metadonnees dans Connection
        // Beaucoup plus simple que WFS : pas de parsing XML, pas de namespaces
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // GET /collections (lien depuis landing page)
        // Parser le JSON → Vec<LayerInfo>
        // Chaque collection = une couche = une source Rhiza
        // Extraire : id, title, description, extent, crs
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // 1. Tenter GET /collections/{id}/schema (si le serveur l'expose)
        // 2. Sinon, fallback : GET /collections/{id}/items?limit=10
        //    → inferer le schema depuis les proprietes GeoJSON
        // Meme logique d'inference que le type source GeoJSON
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // GET /collections/{id}/items?limit=n
        // Parser GeoJSON FeatureCollection
        // Retourner les features comme Vec de maps cle-valeur
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Boucle HATEOAS : suivre les liens rel="next"
        // Stream async qui yield les features page par page
        // Arret : plus de lien "next" dans la reponse
        // Optionnel : ajouter bbox ou datetime pour filtrer
        // Si Part 2 supportee : ajouter crs=EPSG:2056 pour eviter la reprojection
    }
}
```

**Comparaison avec l'implementation WFS** : pas de parsing XML (quick-xml inutile), pas de gestion de namespaces, pas de XSD a parser. Le code est significativement plus simple — essentiellement du HTTP + JSON.

---

## Bibliotheques Rust pertinentes

| Crate | Usage |
|---|---|
| `reqwest` | Client HTTP async — requetes GET vers les endpoints |
| `serde_json` | Parsing JSON — metadonnees, collections, conformance |
| `geojson` | Parsing GeoJSON — reponses features (meme crate que pour le type source GeoJSON) |
| `url` | Construction et manipulation d'URLs |
| `proj` | Reprojection CRS (EPSG:2056 ↔ CRS84) si Part 2 non supportee par le serveur |

> **Pas de crate "OGC API Features client"** existant en Rust. A construire, mais beaucoup plus simple que WFS : c'est du REST + JSON standard, pas besoin de parsing XML ni de gestion de protocole SOAP. Les crates ci-dessus suffisent.

**Crates NON necessaires (contrairement a WFS) :**
- `quick-xml` / `roxmltree` — pas de XML a parser
- Pas de gestion de GML

---

## Ecosysteme suisse

### Etat d'adoption (avril 2026)

| Portail | OGC API Features | Statut |
|---|---|---|
| **geodienste.ch** | Oui — actif depuis v4.0.2 (fevrier 2025) | Tous les thematiques (eCH-0056 v4.1.0). URL type : `https://www.geodienste.ch/db/{dataset}/{lang}/ogcapi` |
| **data.geo.admin.ch** | STAC API (superset OGC API Features Part 1) | Expose des assets/fichiers, pas des features vectorielles interrogeables. URL : `https://data.geo.admin.ch/api/stac/v1/` |
| **api3.geo.admin.ch** | Non — API REST proprietaire | Pas d'OGC API Features, pas prevu a court terme |
| **SITG Geneve** | Pas confirme | WFS reste l'interface principale. Migration a surveiller |
| **Cantons (FR, VD, ZH, BE...)** | Majoritairement WFS 2.0 | Migration progressive attendue via eCH-0056 v4.1 |

### Particularites suisses

- **CRS** : les serveurs suisses doivent supporter EPSG:2056 via le parametre `crs` (Part 2). En pratique, verifier `/conformance` pour confirmer le support Part 2.
- **geodienste.ch** est la reference intercantonal. Format URL : `https://www.geodienste.ch/db/{dataset}/{lang}/ogcapi/collections`. Documentation Swagger disponible a `.../{lang}/ogcapi/api?f=html`.
- **STAC vs OGC API Features** : ne pas confondre. Le STAC de data.geo.admin.ch est techniquement un superset d'OGC API Features, mais les "items" sont des assets (fichiers), pas des features individuelles avec geometries interrogeables.
- **Langue** : memes variantes linguistiques que WFS (`/fra`, `/deu`, `/ita`) dans les URLs geodienste.ch.
- **eCH-0056 v4.1.0** : la norme suisse d'interoperabilite geospatiale inclut desormais OGC API Features. C'est le moteur de l'adoption.

### Exemples reels d'URLs

```bash
# Landing page — cadastre via geodienste.ch
https://www.geodienste.ch/db/avc_0/fra/ogcapi

# Collections — cadastre
https://www.geodienste.ch/db/avc_0/fra/ogcapi/collections

# Items d'une collection (5 features)
https://www.geodienste.ch/db/avc_0/fra/ogcapi/collections/parcelle/items?limit=5

# Documentation Swagger
https://www.geodienste.ch/db/avc_0/fra/ogcapi/api?f=html

# STAC API federal (superset OGC API Features)
https://data.geo.admin.ch/api/stac/v1/
https://data.geo.admin.ch/api/stac/v1/collections
```

### Strategie Rhiza

Pour les donnees vectorielles suisses, privilegier dans cet ordre :
1. **OGC API Features** (geodienste.ch) — le plus simple, REST+JSON
2. **WFS 2.0** — fallback pour les portails cantonaux pas encore migres
3. **GeoJSON / fichiers** — pour les jeux de donnees statiques ou via STAC

Sources :
- [geodienste.ch: STAC API and OGC API Features (Spatialists, fevrier 2025)](https://spatialists.ch/posts/2025/02/21-geodienste-ch-stac-and-ogc-api-features/)
- [OGC API Features — ogcapi.ogc.org](https://ogcapi.ogc.org/features/)
- [data.geo.admin.ch STAC API](https://www.geo.admin.ch/en/rest-interface-stac-api)
- [Swagger geodienste.ch OGC API Features](https://www.geodienste.ch/db/avc_0/fra/ogcapi/api?f=html)
- [MeteoSwiss + swisstopo + Camptocamp: STAC and OGC API Features](https://camptocamp.com/en/news-events/meteoswiss-open-data)
