# WFS — Web Feature Service

## Identité
- **Nom** : WFS (Web Feature Service)
- **Type** : service en ligne (API OGC)
- **Organisme de spec** : OGC (Open Geospatial Consortium) — [OGC WFS 2.0 (ISO 19142:2010)](https://www.ogc.org/standard/wfs/)
- **Versions existantes** : 1.0.0 (2002), 1.1.0 (2004), **2.0.0** (2010, ISO 19142). Recommandation Rhiza : cibler 2.0.0, supporter 1.1.0 en fallback.
- **Statut de maturité** : stable, déploiement massif mondial. Successeur déclaré : OGC API Features, mais WFS reste largement dominant dans l'écosystème suisse.

---

## Mécanisme de découverte

### A. Connexion au service

URL de base du service + paramètres obligatoires : `service=WFS`, `request=GetCapabilities`.

Pas d'authentification pour les portails publics suisses. Headers HTTP standards, `Accept: application/xml`.

**Paramètres obligatoires :**
| Paramètre | Valeur |
|---|---|
| `SERVICE` | `WFS` |
| `REQUEST` | `GetCapabilities` |
| `VERSION` | `2.0.0` (optionnel mais recommandé) |

**Exemple réel suisse — geodienste.ch (cadastre) :**
```
https://geodienste.ch/db/av/fra?SERVICE=WFS&REQUEST=GetCapabilities
```

**Exemple — SITG Genève :**
```
https://ge.ch/sitgags1/services/vector/SITG/wfs?SERVICE=WFS&REQUEST=GetCapabilities
```

> **Attention** : geo.admin.ch (API fédérale) n'expose PAS de WFS standard. Elle utilise une API REST propriétaire (`api3.geo.admin.ch`). Pour les données fédérales en WFS, passer par geodienste.ch ou les miroirs cantonaux.

---

### B. Listing des couches disponibles

L'opération `GetCapabilities` retourne un document XML décrivant le service et listant tous les `FeatureType` exposés.

**Chaque `<FeatureType>` = une source Rhiza.**

Attributs typiques par couche :
- `Name` — identifiant technique (souvent préfixé : `ms:NOM_COUCHE`)
- `Title` — nom lisible
- `Abstract` — description
- `DefaultCRS` — système de coordonnées par défaut
- `OtherCRS` — CRS alternatifs supportés
- `ows:WGS84BoundingBox` — emprise en WGS84

**Extrait concret (tronqué) — réponse type d'un WFS suisse :**
```xml
<FeatureTypeList>
  <FeatureType>
    <Name>ms:DDP_PARCELLE_PARCELLE</Name>
    <Title>Parcelles cadastrales</Title>
    <Abstract>Limites des parcelles du cadastre</Abstract>
    <DefaultCRS>urn:ogc:def:crs:EPSG::2056</DefaultCRS>
    <ows:WGS84BoundingBox>
      <ows:LowerCorner>5.95 45.82</ows:LowerCorner>
      <ows:UpperCorner>10.49 47.81</ows:UpperCorner>
    </ows:WGS84BoundingBox>
  </FeatureType>
  <FeatureType>
    <Name>ms:BATIMENT_BATIMENT</Name>
    <Title>Bâtiments</Title>
    <DefaultCRS>urn:ogc:def:crs:EPSG::2056</DefaultCRS>
    <!-- ... -->
  </FeatureType>
  <!-- ... 28 autres couches ... -->
</FeatureTypeList>
```

---

### C. Description du schéma d'une couche

Opération : `DescribeFeatureType` avec paramètre `typeName=<nom_couche>`.

Réponse : document XSD (XML Schema Definition).

**Exemple d'URL :**
```
https://geodienste.ch/db/av/fra?SERVICE=WFS&REQUEST=DescribeFeatureType&TYPENAME=ms:DDP_PARCELLE_PARCELLE&VERSION=2.0.0
```

**Extrait de réponse XSD :**
```xml
<xsd:complexType name="DDP_PARCELLE_PARCELLEType">
  <xsd:complexContent>
    <xsd:extension base="gml:AbstractFeatureType">
      <xsd:sequence>
        <xsd:element name="IDENTDN" type="xsd:string"/>
        <xsd:element name="NUMERO" type="xsd:string"/>
        <xsd:element name="EGRID" type="xsd:string"/>
        <xsd:element name="SURFACE" type="xsd:double"/>
        <xsd:element name="msGeometry" type="gml:SurfacePropertyType"/>
      </xsd:sequence>
    </xsd:extension>
  </xsd:complexContent>
</xsd:complexType>
```

**Mapping types XSD → types universels :**

| Type XSD | Type universel |
|---|---|
| `xsd:string` | string |
| `xsd:int`, `xsd:integer`, `xsd:long` | integer |
| `xsd:double`, `xsd:float`, `xsd:decimal` | float |
| `xsd:boolean` | boolean |
| `xsd:date`, `xsd:dateTime` | date |
| `gml:PointPropertyType` | geometry (point) |
| `gml:SurfacePropertyType`, `gml:MultiSurfacePropertyType` | geometry (polygon) |
| `gml:CurvePropertyType`, `gml:MultiCurvePropertyType` | geometry (linestring) |
| `gml:GeometryPropertyType` | geometry (generic) |

---

### D. Récupération d'un échantillon de données

Opération : `GetFeature` avec limitation du nombre de résultats.

| Version WFS | Paramètre |
|---|---|
| 2.0.0 | `count=N` |
| 1.1.0 / 1.0.0 | `maxFeatures=N` |

Format de sortie : GML par défaut. GeoJSON si supporté (`outputFormat=application/json`).

**Exemple — 5 parcelles en GeoJSON :**
```
https://geodienste.ch/db/av/fra?SERVICE=WFS&REQUEST=GetFeature&TYPENAME=ms:DDP_PARCELLE_PARCELLE&VERSION=2.0.0&COUNT=5&OUTPUTFORMAT=application/json
```

---

### E. Récupération des données complètes pour import

**Pagination (WFS 2.0 uniquement) :**
- Paramètres `startIndex` + `count`
- Boucler : incrémenter `startIndex` de `count` à chaque itération
- Arrêt : quand `numberReturned < count` ou `startIndex >= numberMatched`

**WFS 1.x** : pas de pagination standard → récupérer tout d'un coup (risque de timeout).

**Filtres côté serveur :**
- WFS 2.0 : Filter Encoding Standard (FES 2.0, OGC 09-026r2) — XML
- WFS 1.x : OGC Filter 1.1 — XML
- Certains serveurs supportent CQL (Common Query Language) en paramètre `CQL_FILTER` (extension GeoServer)

**Formats de retour :**
- GML (défaut, très verbeux — à éviter si possible)
- GeoJSON (`outputFormat=application/json`) — préférable quand supporté
- CSV (rare)

**Limites serveur :** beaucoup de serveurs plafonnent le nombre de features par requête (souvent 1000–10000). Vérifier `<ows:Constraint name="CountDefault">` dans le Capabilities.

**Stratégie Rhiza :** toujours paginer, détecter la limite serveur depuis Capabilities, boucler jusqu'à épuisement.

---

## Pièges et limitations connus

- **Variations entre implémentations** : GeoServer, MapServer, QGIS Server, ArcGIS Server ont chacun leurs particularités. Namespaces XML différents, formats de sortie variables, filtres supportés différents.
- **Namespaces XML** : les noms de couches sont souvent préfixés (`ms:`, `gn:`, etc.). Le préfixe peut changer entre GetCapabilities et GetFeature. Être tolérant au parsing.
- **Ordre des axes CRS** : WFS 2.0 respecte l'ordre EPSG (lat/lon pour EPSG:4326, E/N pour EPSG:2056). WFS 1.x utilise toujours lon/lat. Source majeure de bugs de coordonnées inversées.
- **GML verbeux** : le format GML par défaut est extrêmement verbeux (10–50× la taille GeoJSON). Préférer GeoJSON quand disponible.
- **Timeouts** : les requêtes sans filtre sur de grosses couches provoquent des timeouts côté serveur. Toujours paginer.
- **CORS** : beaucoup de serveurs WFS suisses n'envoient pas de headers CORS → appels depuis un navigateur impossibles, mais OK depuis un backend Rust.
- **Encodage** : réponses généralement en UTF-8, mais certains serveurs anciens retournent du Latin-1 sans le déclarer.
- **Versions mixtes** : un même serveur peut supporter plusieurs versions. Toujours spécifier `VERSION=` explicitement.
- **Limites de features silencieuses** : souvent non documentées, découvertes quand la réponse est tronquée. Comparer `numberMatched` vs `numberReturned` dans la réponse WFS 2.0.
- **Noms de couches avec caractères spéciaux** : espaces, accents, deux-points dans les noms → encoder correctement dans l'URL.

---

## Interface backend Rust proposée

```rust
use async_trait::async_trait;

pub struct WfsSource {
    version: WfsVersion,
    /// Format de sortie préféré (détecté depuis Capabilities)
    output_format: Option<String>,
}

pub enum WfsVersion {
    V1_1_0,
    V2_0_0,
}

#[async_trait]
impl SourceType for WfsSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Envoyer GetCapabilities (reqwest GET)
        // 2. Parser le XML de réponse (quick-xml)
        // 3. Détecter la version la plus haute supportée
        // 4. Détecter les formats de sortie (préférer GeoJSON)
        // 5. Extraire les contraintes (CountDefault, etc.)
        // 6. Stocker les métadonnées du service dans Connection
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // Extraire tous les <FeatureType> du Capabilities (déjà parsé)
        // Pour chaque couche : name, title, abstract, default_crs, bbox
        // Chaque FeatureType = une source Rhiza
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // Envoyer DescribeFeatureType pour la couche
        // Parser le XSD retourné
        // Mapper chaque élément → FieldInfo { name, universal_type }
        // Identifier le champ géométrie et son type
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // GetFeature avec count=n (ou maxFeatures=n si v1.x)
        // Parser la réponse (GeoJSON si disponible, sinon GML)
        // Retourner les features comme Vec de maps clé-valeur
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Pagination : boucle startIndex + count
        // Détecter la limite serveur depuis Capabilities
        // Stream async qui yield les features page par page
        // Arrêt : numberReturned < count ou startIndex >= numberMatched
    }
}
```

---

## Bibliothèques Rust pertinentes

| Crate | Version | Licence | Maintenance | Usage |
|---|---|---|---|---|
| `reqwest` | 0.12+ | MIT/Apache-2.0 | Excellente | Client HTTP async pour les requêtes WFS |
| `quick-xml` | 0.36+ | MIT | Excellente | Parsing XML streaming (Capabilities, XSD, GML) |
| `roxmltree` | 0.20+ | MIT/Apache-2.0 | Bonne | Parsing XML DOM (alternative à quick-xml) |
| `serde` + `serde_json` | 1.x | MIT/Apache-2.0 | Excellente | Désérialisation des réponses GeoJSON |
| `geojson` | 0.24+ | MIT/Apache-2.0 | Bonne (georust) | Parsing GeoJSON natif |
| `proj` | 0.27+ | MIT/Apache-2.0 | Bonne | Reprojection CRS (EPSG:2056 ↔ 4326) |
| `url` | 2.x | MIT/Apache-2.0 | Excellente | Construction d'URLs avec query params |

> **Note** : il n'existe pas de crate Rust "WFS client" clé en main. L'implémentation se fait en combinant reqwest + quick-xml + geojson. C'est un composant que Rhiza devra construire.

---

## Écosystème suisse

### Portails exposant du WFS

| Portail | Canton/Niveau | URL type |
|---|---|---|
| geodienste.ch | Intercantonal | `https://geodienste.ch/db/{dataset}/{lang}?SERVICE=WFS&...` |
| geo.fr.ch | Fribourg | `https://geo.fr.ch/wfs?SERVICE=WFS&...` |
| ge.ch/sitg | Genève | `https://ge.ch/sitgags1/services/vector/SITG/wfs?SERVICE=WFS&...` |
| geo.vd.ch | Vaud | WFS disponible via le géoportail |
| maps.zh.ch | Zurich | WFS disponible |
| geo.be.ch | Berne | WFS cantonal |

### Attention : geo.admin.ch ≠ WFS
L'API fédérale geo.admin.ch utilise une **API REST propriétaire** (`api3.geo.admin.ch`), pas du WFS standard. Pour les données fédérales via WFS, passer par geodienste.ch.

### Particularités suisses
- **CRS** : EPSG:2056 (LV95) est le CRS par défaut de quasi tous les WFS suisses. Rhiza doit supporter la reprojection 2056 ↔ 4326.
- **Namespaces** : MapServer utilise `ms:`, GeoServer utilise des namespaces custom. Être tolérant.
- **Langue** : certains endpoints ont des variantes linguistiques (`/fra`, `/deu`, `/ita`).
- **Couches riches** : un service WFS cantonal peut exposer 30–100 couches → 30–100 sources Rhiza distinctes.

### Exemples réels d'URLs
```bash
# Capabilities — cadastre via geodienste.ch
https://geodienste.ch/db/av/fra?SERVICE=WFS&REQUEST=GetCapabilities

# Capabilities — SITG Genève
https://ge.ch/sitgags1/services/vector/SITG/wfs?SERVICE=WFS&REQUEST=GetCapabilities

# 5 parcelles en GeoJSON — geodienste.ch
https://geodienste.ch/db/av/fra?SERVICE=WFS&REQUEST=GetFeature&TYPENAME=ms:DDP_PARCELLE_PARCELLE&VERSION=2.0.0&COUNT=5&OUTPUTFORMAT=application/json
```
