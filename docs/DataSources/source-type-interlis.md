# INTERLIS

## Identité
- **Nom** : INTERLIS
- **Type** : format de fichier + langage de modélisation de données
- **Organisme de spec** : swisstopo / KOGIS. Normes [eCH-0031](https://www.ech.ch/fr/ech/ech-0031) (INTERLIS 2 — langage de description de données), [eCH-0118](https://www.ech.ch/fr/ech/ech-0118) (GML selon INTERLIS).
- **Versions** : **INTERLIS 1** (fichiers `.itf`, format tabulaire, 1991) et **INTERLIS 2.3/2.4** (fichiers `.xtf`/`.xml`, basé XML, 2006+). Recommandation Rhiza : cibler INTERLIS 2 (.xtf), supporter INTERLIS 1 (.itf) via conversion.
- **Statut de maturité** : **standard légal suisse**. La LGéo (Loi sur la géoinformation, RS 510.62) et l'OGéo (Ordonnance, RS 510.620) imposent INTERLIS comme format d'échange pour les géodonnées de droit fédéral.

---

## Mécanisme de découverte

### A. Connexion au service/fichier

INTERLIS fonctionne en couple : un **modèle de données** (`.ili`) décrit la structure, un **fichier de transfert** (`.xtf` pour INTERLIS 2, `.itf` pour INTERLIS 1) contient les données.

**Dépôts de modèles :**
- `https://models.interlis.ch/` — dépôt communautaire principal
- `https://models.geo.admin.ch/` — modèles fédéraux officiels (swisstopo, OFEV, ARE, OFS)

**Données :** téléchargées depuis les portails cantonaux ou fédéraux (geodienste.ch, portails cantonaux).

**Exemple concret — MOpublic (mensuration officielle simplifiée) :**
- Modèle : `https://models.geo.admin.ch/V_D/OeREB/` (dépôt modèles fédéraux)
- Données : téléchargeables par canton sur geodienste.ch

**Connexion Rhiza :**
1. Recevoir un fichier `.xtf` (ou `.itf`)
2. Lire l'en-tête XML pour identifier le modèle référencé (`<MODELS>` dans le `.xtf`)
3. Résoudre le modèle `.ili` (local ou depuis `models.interlis.ch`)
4. Vérifier la version INTERLIS (1 ou 2)

---

### B. Listing des couches disponibles

Un fichier INTERLIS est structuré hiérarchiquement : **MODEL > TOPIC > CLASS**.

**Chaque CLASS = une couche = une source Rhiza.**

Pour lister les couches, parser le fichier modèle `.ili` ou lire les sections `<DATASECTION>` du `.xtf`.

**Extrait concret d'un modèle .ili (MOpublic simplifié) :**
```interlis
MODEL MOpublic_V1_0 (fr) AT "https://models.geo.admin.ch"
  VERSION "2023-01-01" =

  IMPORTS GeometryCHLV95_V1;

  TOPIC Batiments =
    CLASS Batiment =
      Geometrie : MANDATORY GeometryCHLV95_V1.Surface;
      EGID : 0 .. 999999999;
      Nom : TEXT*200;
      Designation : TEXT*200;
      Statut : (
        projete,
        en_construction,
        existant,
        demoli
      );
    END Batiment;
  END Batiments;

  TOPIC Biens_fonciers =
    CLASS Bien_foncier =
      Geometrie : MANDATORY GeometryCHLV95_V1.Surface;
      Numero : MANDATORY TEXT*12;
      EGRID : TEXT*14;
      TypeBF : MANDATORY (
        Bien_fonds,
        DDP,
        Mine,
        Part_copropriete
      );
    END Bien_foncier;
  END Biens_fonciers;

END MOpublic_V1_0.
```

→ 2 couches Rhiza : `Batiments.Batiment` et `Biens_fonciers.Bien_foncier`

---

### C. Description du schéma d'une couche

**Le modèle `.ili` EST le schéma formel et complet** — contrairement à GeoJSON ou CSV, pas besoin d'inférence. C'est la grande force d'INTERLIS.

**Mapping types INTERLIS → types universels :**

| Type INTERLIS | Type universel | Notes |
|---|---|---|
| `TEXT*n` | string | Longueur max n caractères |
| `MTEXT*n` | string | Texte multiligne |
| `MANDATORY TEXT` | string (non null) | |
| `0 .. 999999` | integer | Plage numérique entière |
| `0.000 .. 100.000` | float | Plage numérique décimale (précision explicite) |
| `BOOLEAN` | boolean | |
| `INTERLIS.XMLDate` | date | yyyy-mm-dd |
| `INTERLIS.XMLDateTime` | datetime | |
| `ENUMERATION (val1, val2, ...)` | enum / string | Liste fermée de valeurs |
| `COORD` | geometry (point) | |
| `POLYLINE` | geometry (linestring) | Peut contenir des arcs |
| `SURFACE` | geometry (polygon) | Topologique, bords partagés |
| `AREA` | geometry (polygon) | Partitionnement complet, sans trous ni chevauchements |
| `GeometryCHLV95_V1.Coord2` | geometry (point, EPSG:2056) | |
| `GeometryCHLV95_V1.Surface` | geometry (polygon, EPSG:2056) | |
| `BAG {..} OF` | array | Collection non ordonnée |
| `LIST {..} OF` | array | Collection ordonnée |

**Extrait concret — schéma de `Batiment` :**
```
Geometrie   → geometry (polygon, EPSG:2056)  [MANDATORY]
EGID        → integer (0–999999999)
Nom         → string (max 200)
Designation → string (max 200)
Statut      → enum (projete, en_construction, existant, demoli)
```

---

### D. Récupération d'un échantillon de données

Parser le fichier `.xtf` (XML) et extraire les N premiers objets d'une CLASS donnée.

**Structure XML d'un fichier .xtf :**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<TRANSFER xmlns="http://www.interlis.ch/INTERLIS2.3">
  <HEADERSECTION>
    <MODELS>
      <MODEL NAME="MOpublic_V1_0" URI="https://models.geo.admin.ch" VERSION="2023-01-01"/>
    </MODELS>
  </HEADERSECTION>
  <DATASECTION>
    <MOpublic_V1_0.Batiments BID="FR_batiments">
      <MOpublic_V1_0.Batiments.Batiment TID="b1">
        <Geometrie>
          <SURFACE>
            <BOUNDARY>
              <POLYLINE>
                <COORD><C1>2578100.000</C1><C2>1183900.000</C2></COORD>
                <COORD><C1>2578120.000</C1><C2>1183900.000</C2></COORD>
                <COORD><C1>2578120.000</C1><C2>1183920.000</C2></COORD>
                <COORD><C1>2578100.000</C1><C2>1183920.000</C2></COORD>
              </POLYLINE>
            </BOUNDARY>
          </SURFACE>
        </Geometrie>
        <EGID>190000001</EGID>
        <Nom>Bâtiment Musy 96</Nom>
        <Statut>existant</Statut>
      </MOpublic_V1_0.Batiments.Batiment>
      <!-- ... autres bâtiments ... -->
    </MOpublic_V1_0.Batiments>
  </DATASECTION>
</TRANSFER>
```

---

### E. Récupération des données complètes pour import

Trois stratégies possibles, par ordre de recommandation :

**Stratégie 1 — ili2pg (recommandée pour Rhiza)**
Utiliser `ili2pg` (outil Java) pour importer directement dans PostGIS :
```bash
java -jar ili2pg.jar \
  --import \
  --dbhost localhost --dbport 5432 \
  --dbdatabase rhiza --dbschema mopublic \
  --dbusr postgres --dbpwd xxx \
  --models MOpublic_V1_0 \
  donnees.xtf
```
- **Avantage** : gestion complète des types, relations, géométries, validations, héritage
- **Inconvénient** : dépendance Java (JRE 8+)

**Stratégie 2 — ili2gpkg (intermédiaire GeoPackage)**
```bash
java -jar ili2gpkg.jar --import --models MOpublic_V1_0 donnees.xtf
```
Produit un fichier `.gpkg` lisible par n'importe quel outil géo. Rhiza lit ensuite le GeoPackage comme source standard.

**Stratégie 3 — Parsing XML direct du .xtf**
Lire le XML avec un parser streaming (quick-xml en Rust). Extraire les objets classe par classe.
- **Avantage** : pas de dépendance externe
- **Inconvénient** : ne gère pas les modèles complexes (héritage EXTENDS, associations, contraintes)

**Tailles typiques :** un export cantonal MOpublic fait entre 100 MB et 2 GB en `.xtf`.

---

## Pièges et limitations connus

1. **Complexité du langage .ili** : INTERLIS 2 est un langage de modélisation complet avec héritage (`EXTENDS`), associations (`ASSOCIATION`), contraintes (`MANDATORY`, `UNIQUE`, `EXISTENCE CONSTRAINT`), vues (`VIEW`), fonctions. Parser un `.ili` correctement est un projet en soi — c'est pourquoi l'écosystème entier repose sur les outils Java de KOGIS.

2. **INTERLIS 1 vs 2** : formats radicalement différents. INTERLIS 1 (`.itf`) est tabulaire (proche CSV avec des séparateurs spéciaux), INTERLIS 2 (`.xtf`) est XML. Beaucoup de données cantonales sont **encore en INTERLIS 1**. Utiliser ili2db pour convertir.

3. **Modèles imbriqués** : un modèle peut `IMPORTS` d'autres modèles, qui eux-mêmes importent d'autres modèles. Il faut résoudre toute la chaîne de dépendances depuis les dépôts (`models.interlis.ch`, `models.geo.admin.ch`).

4. **TID et références** : les objets sont identifiés par des TID (Transfer ID). Les associations référencent des TID d'autres classes → foreign keys inter-classes. Gérer ces références est nécessaire pour reconstruire les relations.

5. **AREA vs SURFACE** : `AREA` implique un partitionnement complet du territoire (pas de trous, pas de chevauchements entre objets). `SURFACE` est plus libre. La sémantique topologique compte pour l'intégrité des données.

6. **Absence de bibliothèques Rust natives** : **aucun crate Rust ne parse INTERLIS** (ni `.ili` ni `.xtf`/`.itf`). Obligation de wrapper des outils Java ou de parser le XML brut avec ses limitations.

7. **Géométries avec arcs** : les polylignes INTERLIS peuvent contenir des `ARC` (arcs de cercle), non représentables en GeoJSON ou WKT. Nécessite une **linéarisation** (approximation par segments droits). ili2db le fait automatiquement.

8. **Encodage** : UTF-8 pour INTERLIS 2, parfois ISO 8859-1 pour INTERLIS 1.

9. **Fichiers volumineux** : un export cantonal complet peut dépasser 1 GB en XML. Streaming obligatoire si parsing direct.

10. **Validation** : `ilivalidator` (Java) est l'outil de référence pour valider la conformité d'un `.xtf` à son modèle `.ili`. Rhiza devrait valider avant import pour éviter les données corrompues.

---

## Interface backend Rust proposée

```rust
use async_trait::async_trait;
use std::path::PathBuf;

pub struct InterlisSource {
    /// Stratégie d'import choisie
    strategy: ImportStrategy,
    /// Chemin vers ili2pg.jar (si stratégie Java)
    ili2db_jar: Option<PathBuf>,
    /// Chemin vers ilivalidator.jar
    ilivalidator_jar: Option<PathBuf>,
}

pub enum ImportStrategy {
    /// Wrapper ili2pg via CLI — recommandé, complet
    Ili2pg {
        db_host: String,
        db_port: u16,
        db_name: String,
        db_schema: String,
    },
    /// Conversion en GeoPackage intermédiaire
    Ili2gpkg,
    /// Parsing XML direct du .xtf — limité mais sans dépendance Java
    DirectXtf,
}

#[async_trait]
impl SourceType for InterlisSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Identifier le fichier .xtf ou .itf
        // 2. Lire l'en-tête XML (<HEADERSECTION>) pour identifier le modèle
        // 3. Résoudre le modèle .ili :
        //    a. Chercher localement
        //    b. Télécharger depuis models.interlis.ch / models.geo.admin.ch
        //    c. Résoudre les dépendances (IMPORTS récursifs)
        // 4. Détecter la version INTERLIS (1 ou 2)
        // 5. Si stratégie Ili2pg : vérifier que Java et ili2pg.jar sont disponibles
        //    → java -version, test d'accès au .jar
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // Parser le modèle .ili ou le .xtf pour extraire les TOPIC > CLASS
        // Chaque CLASS = une couche Rhiza
        // Nom qualifié : "Model.Topic.Class"
        // Exemple : ["MOpublic_V1_0.Batiments.Batiment",
        //            "MOpublic_V1_0.Biens_fonciers.Bien_foncier"]
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // Parser le modèle .ili pour la CLASS demandée
        // Extraire chaque attribut avec son type INTERLIS
        // Mapper vers les types universels (cf. table)
        // Inclure les contraintes (MANDATORY, domaines)
        // Identifier le champ géométrie et son type + CRS
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // Stratégie DirectXtf :
        //   Parser le XML, filtrer par CLASS, prendre les N premiers TID
        // Stratégie Ili2pg :
        //   Importer (si pas déjà fait) puis SELECT ... LIMIT n
        // Retourner les attributs comme maps clé-valeur
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Stratégie Ili2pg :
        //   1. Valider : java -jar ilivalidator.jar fichier.xtf
        //   2. Importer : java -jar ili2pg.jar --import ... fichier.xtf
        //   3. Stream depuis la table PostGIS : SELECT * FROM schema.class
        // Stratégie DirectXtf :
        //   1. Parser XML streaming (quick-xml)
        //   2. Yield chaque objet de la CLASS cible
        //   3. Linéariser les arcs géométriques
        // Stratégie Ili2gpkg :
        //   1. java -jar ili2gpkg.jar --import ... fichier.xtf
        //   2. Lire le .gpkg résultant
    }
}
```

### Comparaison des stratégies

| Critère | ili2pg | ili2gpkg | Direct XTF |
|---|---|---|---|
| Complétude du support | Excellente | Excellente | Partielle |
| Dépendance Java | Oui (JRE 8+) | Oui (JRE 8+) | Non |
| Performance | Bonne | Bonne | Variable |
| INTERLIS 1 (.itf) | Oui | Oui | Très difficile |
| Géométries complexes (arcs) | Oui (linéarisation auto) | Oui | Manuel |
| Associations / refs | Oui (FK SQL) | Oui | Manuel |
| Héritage (EXTENDS) | Oui | Oui | Non |
| **Recommandation Rhiza** | **Phase 1** | Backup | Phase 2 éventuelle |

---

## Bibliothèques Rust pertinentes

**Constat honnête : il n'existe aucun crate Rust natif pour parser INTERLIS** (ni `.ili` ni `.xtf`/`.itf`). L'écosystème INTERLIS est entièrement Java.

### Crates Rust utiles indirectement

| Crate | Version | Licence | Usage pour Rhiza |
|---|---|---|---|
| `quick-xml` | 0.36+ | MIT | Parsing streaming du `.xtf` (stratégie DirectXtf) |
| `roxmltree` | 0.20+ | MIT/Apache-2.0 | Parsing DOM du `.xtf` (petits fichiers) |
| `serde` + `serde_json` | 1.x | MIT/Apache-2.0 | Sérialisation des données extraites |
| `reqwest` | 0.12+ | MIT/Apache-2.0 | Téléchargement de modèles depuis models.interlis.ch |
| `tokio::process` | 1.x | MIT | Exécution async de ili2pg/ilivalidator (wrapping Java) |
| `proj` | 0.27+ | MIT/Apache-2.0 | Reprojection (normalement inutile : INTERLIS suisse = EPSG:2056) |

### Outils Java de l'écosystème INTERLIS (à wrapper depuis Rust)

| Outil | Fonction | Licence | Mainteneur |
|---|---|---|---|
| **ili2pg** | Import/export INTERLIS ↔ PostGIS | LGPL | Eisenhut Informatik |
| **ili2gpkg** | Import/export INTERLIS ↔ GeoPackage | LGPL | Eisenhut Informatik |
| **ilivalidator** | Validation conformité .xtf vs .ili | LGPL | KOGIS / Eisenhut |
| **iox-ili** | Bibliothèque Java de parsing INTERLIS | LGPL | Eisenhut Informatik |
| **ili2c** | Compilateur de modèles .ili | LGPL | KOGIS |

> Tous ces outils sont open source et maintenus activement. Le wrapping via `std::process::Command` (ou `tokio::process::Command` en async) est la stratégie la plus pragmatique pour Rhiza.

---

## Écosystème suisse

### C'est LE format suisse

INTERLIS est une spécificité suisse sans équivalent mondial. Né du besoin de la mensuration officielle suisse d'échanger des géodonnées structurées entre cantons, communes et Confédération. Imposé par la loi fédérale pour toutes les géodonnées de droit fédéral.

### Dépôts de modèles
- `https://models.interlis.ch/` — dépôt communautaire, tous les modèles publics
- `https://models.geo.admin.ch/` — modèles fédéraux officiels

### Modèles fédéraux clés pour Rhiza

| Modèle | Contenu | Pertinence ontologie Rhiza |
|---|---|---|
| **MOpublic** | Mensuration officielle simplifiée (parcelles, bâtiments, adresses) | Nœuds **Territoire** |
| **OeREBKRM (RDPPF)** | Cadastre des restrictions de droit public à la propriété foncière | Nœuds **Décision** |
| **Nutzungsplanung** | Plans d'affectation communaux/cantonaux | Nœuds **Territoire** |
| **SIA405** | Cadastre des conduites (eau, gaz, électricité, télécom) | Nœuds **Flux** |
| **RegBL** | Registre des bâtiments et logements | Nœuds **Territoire** |
| **DM01 / MO** | Mensuration officielle détaillée | Nœuds **Territoire** |

### Portails de téléchargement

| Portail | URL | Contenu |
|---|---|---|
| geodienste.ch | `https://geodienste.ch/` | Données INTERLIS par canton et modèle |
| cadastre.ch | `https://cadastre.ch/` | Cadastre RDPPF en INTERLIS |
| data.geo.admin.ch | `https://data.geo.admin.ch/` | Certaines données fédérales en INTERLIS |
| geo.fr.ch | Fribourg | MOpublic, plans d'affectation |
| ge.ch/sitg | Genève | Données cantonales |
| geodonnees.vd.ch | Vaud | Données cantonales |

### Exemple concret bout-en-bout pour Rhiza (Fribourg)

```bash
# 1. Télécharger MOpublic pour Fribourg
#    → depuis geodienste.ch, section "Téléchargement", canton FR
wget "https://geodienste.ch/downloads/mopublic/fr/mopublic_fr.xtf.zip"

# 2. Dézipper
unzip mopublic_fr.xtf.zip

# 3. Valider avec ilivalidator
java -jar ilivalidator.jar mopublic_fr.xtf

# 4. Importer dans PostGIS avec ili2pg
java -jar ili2pg.jar \
  --import \
  --dbhost localhost --dbport 5432 \
  --dbdatabase rhiza --dbschema mopublic \
  --dbusr postgres --dbpwd xxx \
  --models MOpublic_V1_0 \
  mopublic_fr.xtf

# 5. Vérifier dans PostGIS
psql -d rhiza -c "SELECT count(*) FROM mopublic.batiment;"
# → ~45'000 bâtiments pour le canton de Fribourg

# 6. Rhiza peut maintenant streamer depuis la table PostGIS
```
