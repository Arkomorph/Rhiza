# CSV — Comma-Separated Values

## Identité
- **Nom** : CSV (Comma-Separated Values)
- **Type** : format de fichier
- **Organisme de spec** : IETF — [RFC 4180](https://datatracker.ietf.org/doc/html/rfc4180) (octobre 2005)
- **Versions** : RFC 4180 est la seule spec formelle. Nombreuses variantes de facto (séparateurs `;` `\t`, encodages, guillemets).
- **Statut de maturité** : stable, universellement supporté. Format le plus simple et le plus répandu pour les données tabulaires ouvertes.

---

## Mécanisme de découverte

### A. Connexion au service/fichier

Deux modes d'accès :
1. **URL HTTP** : `GET` sur une URL directe. Content-Type déclaré : `text/csv` (RFC 4180 §1) — en pratique souvent `application/octet-stream` ou `text/plain`.
2. **Fichier local** : upload ou chemin vers un fichier `.csv`.

**Détection de l'encodage (critique en Suisse) :**
1. Vérifier la présence d'un BOM UTF-8 (`\xEF\xBB\xBF`) en début de fichier
2. Si pas de BOM → heuristique (chardet/chardetng) : tester UTF-8, Latin-1 (ISO 8859-1), Windows-1252
3. Les exports OFS/BFS et Excel suisses sont souvent en **Windows-1252** ou **Latin-1**, pas UTF-8

**Détection du séparateur (critique en Suisse) :**
- RFC 4180 définit `,` comme séparateur
- La Suisse utilise la **virgule comme séparateur décimal** → les CSV suisses utilisent **`;`** comme délimiteur
- Algorithme : compter les occurrences de `,` `;` `\t` sur les 5 premières lignes, choisir le plus fréquent et régulier

**Exemple suisse réel — OFS (BFS) :**
```
https://www.bfs.admin.ch/bfs/fr/home/statistiques/catalogues-banques-donnees/tableaux.html
```
→ Export CSV avec `;` comme séparateur, encodage variable.

**Exemple — opendata.swiss :**
```
https://opendata.swiss/fr/dataset?res_format=CSV
```

---

### B. Listing des couches disponibles

**Un fichier CSV = une couche = une source Rhiza.** Pas de listing multi-couches.

Le nom de la source = nom du fichier sans extension.

---

### C. Description du schéma d'une couche

**Ligne 1 = noms de colonnes** (si présente). Si absente (rare), générer `col_0`, `col_1`, ...

**Algorithme d'inférence de types (scanner N lignes, N=100 par défaut) :**

Pour chaque colonne, tester dans l'ordre :

| Test | Type universel | Pattern | Exemples suisses |
|---|---|---|---|
| Vide / null | nullable | `""`, vide | |
| Booléen | boolean | `true/false`, `1/0`, `oui/non`, `ja/nein` | |
| Entier | integer | `^-?\d+$` | `2196` (BFS-Nr) |
| Entier CH | integer | `^-?\d{1,3}('\d{3})*$` | `1'234'567` (apostrophe milliers) |
| Flottant | float | `^-?\d+[.,]\d+$` | `2578100.0` ou `2578100,0` |
| Date ISO | date | `yyyy-mm-dd` | `2024-12-31` |
| Date CH | date | `dd.mm.yyyy` | `31.12.2024` |
| Identifiant EGID | integer (sémantique: EGID) | 9 chiffres, colonne nommée `EGID` | `190000001` |
| Identifiant EGRID | string (sémantique: EGRID) | `CH\d{12,}` | `CH955832730326` |
| Coordonnée E | float (sémantique: coord_e) | Colonne `E`, `GKODE`, `easting`, valeur 2'400'000–2'900'000 | `2578100.000` |
| Coordonnée N | float (sémantique: coord_n) | Colonne `N`, `GKODN`, `northing`, valeur 1'050'000–1'350'000 | `1183900.000` |
| Latitude | float (sémantique: lat) | Colonne `lat`/`latitude`, valeur 45–48 | `46.8065` |
| Longitude | float (sémantique: lon) | Colonne `lon`/`longitude`, valeur 5–11 | `7.1620` |
| WKT | geometry | `^(POINT\|LINESTRING\|POLYGON)` | `POINT(2578100 1183900)` |
| String | string | Défaut | Tout le reste |

**Détection de colonnes géographiques :** par nom de colonne ET par plage de valeurs. Distinguer EPSG:2056 (E/N grands) de WGS84 (lat/lon petits).

**Extrait concret — CSV RegBL suisse :**
```csv
EGID;GDEKT;GDEBFS;GDENAME;STRNAME;DESSION;PLZ4;GKODE;GKODN;GSTAT
190000001;FR;2196;Fribourg;Rue de Morat;1;1700;2578100.0;1183900.0;1004
190000002;FR;2196;Fribourg;Rue de Lausanne;15;1700;2578200.0;1183800.0;1004
```

Schéma inféré :
```
EGID    → integer (sémantique: EGID)
GDEKT   → string
GDEBFS  → integer (sémantique: BFS-Nr)
GDENAME → string
STRNAME → string
DESSION → string
PLZ4    → integer (sémantique: NPA)
GKODE   → float (sémantique: coord_e, EPSG:2056)
GKODN   → float (sémantique: coord_n, EPSG:2056)
GSTAT   → integer
```

---

### D. Récupération d'un échantillon de données

- Lire l'en-tête + les N premières lignes de données
- Streaming ligne par ligne, arrêt après N
- **Attention** : les champs entre guillemets peuvent contenir des `\n` (sauts de ligne dans les valeurs). Le parser doit gérer les champs multi-lignes correctement — ne pas compter les `\n` bruts.

---

### E. Récupération des données complètes pour import

- **Streaming ligne par ligne** : mémoire O(1) par ligne. Le crate `csv` de BurntSushi supporte nativement le streaming.
- Pas de pagination (fichier entier).
- **Taille pratique** : pas de limite technique. Au-delà de ~1 GB, prévoir un indicateur de progression.
- **Gestion des erreurs** : lignes malformées (nombre de colonnes incorrect, guillemets non fermés) → log + skip ou abort selon configuration Rhiza.
- **Normalisation à l'import** :
  - Stripper les apostrophes des nombres suisses (`1'234'567` → `1234567`)
  - Normaliser les séparateurs décimaux (`,` → `.`)
  - Parser les dates selon le format détecté
  - Construire les géométries Point depuis les colonnes coordonnées

---

## Pièges et limitations connus

- **Séparateur `;`** : la Suisse utilise la virgule comme séparateur décimal → les CSV suisses utilisent `;` comme délimiteur. RFC 4180 ne prévoit que `,`. Rhiza **doit** auto-détecter.
- **Encodage** : beaucoup de fichiers OFS/cantonaux sont en Latin-1 ou Windows-1252, pas UTF-8. Les exports Excel ajoutent souvent un BOM UTF-8 (`\xEF\xBB\xBF`) qui pollue le nom de la première colonne si non détecté.
- **Séparateur de milliers** : `1'000'000` (apostrophe suisse) ou `1 000 000` (espace insécable). Doit être strippé avant parsing numérique. Le crate `csv` ne le fait pas automatiquement.
- **Dates ambiguës** : `01.02.2024` = 1er février (format suisse dd.mm.yyyy) ou 2 janvier (format US mm/dd/yyyy) ? En Suisse, toujours dd.mm.yyyy sauf indication contraire.
- **Guillemets** : les champs contenant le séparateur doivent être entre `"..."` (RFC 4180 §2.6). Guillemets internes échappés par `""`. Certains fichiers utilisent `'` au lieu de `"`.
- **Lignes vides** : fréquentes en fin de fichier. Les ignorer silencieusement.
- **Colonnes géo ambiguës** : `E`/`N` en EPSG:2056 (valeurs ~2'600'000/1'200'000) vs `lon`/`lat` en WGS84 (valeurs ~7/47). Détecter par plage de valeurs, pas seulement par nom.
- **Pas de typage natif** : tout est string dans un CSV. L'inférence peut se tromper : les codes postaux (`1700`) ressemblent à des entiers mais sont sémantiquement des strings. Les numéros BFS (`2196`) aussi.
- **Fichiers sans en-tête** : rares mais existants (exports machine, séries temporelles). Détecter : si la première ligne contient des valeurs numériques là où on attendrait des noms, c'est probablement sans en-tête.
- **Retours de ligne** : `\r\n` (Windows/Excel) vs `\n` (Unix). Le crate `csv` gère les deux nativement.
- **Nombres avec `E` scientifique** : `1.23E+06` peut être confondu avec une coordonnée E. Parser prudemment.

---

## Interface backend Rust proposée

```rust
use async_trait::async_trait;

pub struct CsvSource {
    /// Séparateur détecté ou forcé (b',' ou b';' ou b'\t')
    delimiter: Option<u8>,
    /// Encodage détecté ou forcé
    encoding: Option<String>,
    /// Le fichier a-t-il une ligne d'en-tête ?
    has_header: bool,  // true par défaut
    /// Caractère de guillemet
    quote_char: u8,    // b'"' par défaut
}

#[async_trait]
impl SourceType for CsvSource {
    async fn connect(&self, endpoint: &str) -> Result<Connection> {
        // 1. Si URL HTTP(S) → télécharger (reqwest, streaming)
        // 2. Si chemin local → ouvrir le fichier
        // 3. Lire les premiers octets :
        //    a. Détecter BOM UTF-8
        //    b. Détecter encodage (chardetng si pas de BOM)
        //    c. Détecter séparateur (analyse fréquentielle sur 5 lignes)
        // 4. Valider : au moins 2 colonnes, lignes cohérentes en nombre de champs
    }

    async fn list_layers(&self, conn: &Connection) -> Result<Vec<LayerInfo>> {
        // Toujours Vec de 1 élément
        // name = nom du fichier sans extension
        // feature_count = nombre de lignes (compter \n si besoin, ou None)
    }

    async fn describe_layer(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<LayerSchema> {
        // Lire l'en-tête → noms de colonnes
        // Scanner N premières lignes → inférer types (cf. table ci-dessus)
        // Détecter colonnes géo (par nom ET par plage de valeurs)
        // Détecter identifiants suisses (EGID, EGRID, BFS-Nr)
        // Retourner : Vec<FieldInfo { name, type, semantic_hint, nullable }>
    }

    async fn sample_data(
        &self,
        conn: &Connection,
        layer_id: &str,
        n: usize,
    ) -> Result<Vec<FeatureSample>> {
        // Lire les n premières lignes après l'en-tête
        // Retourner comme Vec de maps clé-valeur (StringRecord → HashMap)
    }

    async fn fetch_all(
        &self,
        conn: &Connection,
        layer_id: &str,
    ) -> Result<FeatureStream> {
        // Stream async ligne par ligne (csv::Reader est streaming natif)
        // Appliquer la normalisation :
        //   - Stripper apostrophes des nombres (1'000 → 1000)
        //   - Normaliser séparateur décimal (, → .)
        //   - Parser dates selon format détecté
        //   - Construire Point geometry si colonnes coordonnées détectées
    }
}
```

---

## Bibliothèques Rust pertinentes

| Crate | Version | Licence | Maintenance | Usage |
|---|---|---|---|---|
| `csv` | 1.3+ | MIT/Unlicense | Excellente (BurntSushi) | Parsing CSV performant, streaming, séparateur configurable (`b';'`). **La** référence Rust. |
| `encoding_rs` | 0.8+ | MIT/Apache-2.0 | Excellente (Mozilla) | Conversion d'encodages (Latin-1 → UTF-8, Windows-1252 → UTF-8) |
| `chardetng` | 0.1+ | MIT/Apache-2.0 | Correcte | Détection automatique d'encodage par heuristique |
| `chrono` | 0.4+ | MIT/Apache-2.0 | Excellente | Parsing de dates multi-formats (`dd.mm.yyyy`, `yyyy-mm-dd`, etc.) |
| `reqwest` | 0.12+ | MIT/Apache-2.0 | Excellente | HTTP client async pour téléchargement |
| `tokio` | 1.x | MIT | Excellente | Runtime async, streaming fichiers |
| `proj` | 0.27+ | MIT/Apache-2.0 | Bonne | Reprojection si coordonnées géo détectées (EPSG:2056 ↔ 4326) |

> **Note** : le crate `csv` de BurntSushi est extrêmement performant et gère nativement : séparateurs custom, guillemets, streaming, lignes flexibles. C'est la base naturelle pour Rhiza.

---

## Écosystème suisse

### Portails principaux

| Portail | URL | Notes |
|---|---|---|
| opendata.swiss | `https://opendata.swiss/` | Catalogue fédéral, des centaines de datasets CSV |
| OFS / BFS | `https://www.bfs.admin.ch/` | Statistiques démographiques, économiques, spatiales. Massivement en CSV avec `;`. |
| RegBL (Registre des bâtiments) | `https://www.housing-stat.ch/` | Export CSV avec EGID, coordonnées E/N en EPSG:2056 |
| stat.fr.ch | Fribourg | Statistiques cantonales |
| statistik.zh.ch | Zurich | Statistiques cantonales |
| Portails cantonaux divers | GE, VD, BE, etc. | Données tabulaires en CSV |

### Particularités suisses — résumé

| Aspect | Standard (RFC 4180) | Réalité suisse |
|---|---|---|
| Séparateur | `,` | **`;`** (quasi-systématique) |
| Décimales | `.` | `,` ou `.` selon la source |
| Milliers | (aucun) | **`'`** (apostrophe) — `1'234'567` |
| Dates | (non spécifié) | **`dd.mm.yyyy`** dominant |
| Encodage | (non spécifié) | Mix UTF-8 (avec BOM) et **Latin-1/Windows-1252** |
| Coordonnées | (non applicable) | **EPSG:2056** (E ≈ 2'500'000–2'850'000, N ≈ 1'050'000–1'300'000) |
| Multilinguisme | (non applicable) | En-têtes parfois en DE, FR, IT, ou codes techniques |

### Exemples réels

```bash
# Recherche CSV sur opendata.swiss
https://opendata.swiss/fr/dataset?res_format=CSV

# Statistiques de la population — OFS
https://www.bfs.admin.ch/bfs/fr/home/statistiques/population.html
# → onglet "Données" → téléchargement CSV (séparateur ;, encodage variable)

# Registre des bâtiments RegBL
https://www.housing-stat.ch/fr/madd/public.html
# → Export CSV avec EGID, GKODE, GKODN en EPSG:2056
```
