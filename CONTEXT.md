# Rhiza

Infrastructure de lisibilité du territoire urbain suisse. Révèle les relations invisibles entre acteurs, flux, décisions et espaces par un graphe relationnel abductif.

## Language

### Ontologie — les 4 types de nœuds

**Territoire**:
L'espace réel — la réalité spatiale observée et vécue (le Schönberg, une parcelle, un corridor écologique). Quand on parle du modèle, on utilise le label `:Territoire`.
_Avoid_: zone, secteur, lieu

**Acteur**:
Entité modélisée dans le graphe qui détient du pouvoir ou subit des effets sur le territoire. Peut être une institution, une personne, un collectif. N'est jamais un compte utilisateur de l'outil.
_Avoid_: utilisateur, usager (quand on parle du graphe)

**Flux**:
Se manifeste de deux manières. (1) Nœud `:Flux` quand c'est une infrastructure dédiée (réseau de transports publics, réseau de distribution d'eau, circuit financier institutionnel) — a un opérateur propre, une infrastructure propre, un cycle de vie propre. (2) Propriété d'arête quand c'est une ressource qui circule entre nœuds existants (argent, énergie, matière, personnes, information) — qualifie la relation.
_Avoid_: transfert (trop vague), réseau (trop infrastructure-only)

**Décision**:
Opérateur temporel — le seul nœud qui produit un delta dans le graphe. Un PAL modifié, un programme de rénovation lancé, un droit de superficie accordé. La Décision est dans le graphe (comme nœud daté et sourcé) ET agit sur le graphe (elle transforme les relations entre Acteurs, Territoires et Flux).
_Avoid_: action, événement, changement

### Import de données — la chaîne Source → Mapping → Pattern

**Source**:
Une couche de données externe avec un endpoint, un format (WFS, GeoJSON, CSV...) et des champs exposés. Vit dans le catalogue. Peut être liée à un ou plusieurs Territoires.
_Avoid_: dataset, fichier, couche (trop SIG)

**Mapping**:
Association d'un champ de la Source vers une propriété intrinsèque du Schéma (attribut du nœud). Mapping = champ → propriété. Step 2 du stepper.
_Avoid_: pattern (qui cible les relations, pas les propriétés)

**Pattern**:
Règle qui décrit comment un champ de la Source crée ou lie une relation (arête) dans le graphe. Pattern = champ → relation. Step 3 du stepper. Contient une triplette relationnelle (nœud importé, type d'arête, nœud cible) et un mode de résolution (lier à un existant, créer un nouveau).
_Avoid_: mapping (qui cible les propriétés, pas les relations)

### Structure du modèle

**Ontologie**:
La représentation de la réalité qu'on décide d'établir. Vision de l'outil : représentation par graphe, avec un nombre décidé de types de nœuds (4) et de types de relations (9). L'ontologie est stable — on ne la change que si un cas réel ne peut pas être modélisé (règle KIS).
_Avoid_: schéma (qui est le blueprint pratique, pas la vision)

**Schéma**:
Le blueprint pratique de chaque élément de l'ontologie. Fixe quelles propriétés décrivent chaque type de nœud (rend le Mapping possible) et quelles relations un type de nœud induit (rend les Patterns possibles). Éditable dans l'onglet Schéma du front. Peut évoluer sans que l'ontologie change.
_Avoid_: ontologie (qui est la vision fondatrice, pas le détail des propriétés)

**Arête attendue**:
Déclaration dans le Schéma qu'un type de nœud *devrait* avoir une relation vers un autre type. Caractérisée par : type d'arête, direction, obligation (hard/soft), multiplicité (one/many), mode pattern par défaut. Pré-remplit les Patterns au Step 3 d'une Source ciblant ce type.
_Avoid_: attente ontologique (jargonnant), contrainte (trop rigide — soft n'est pas une contrainte)

**Bidirectionnalité**:
Principe selon lequel une arête attendue déclarée d'un côté (ex: Territoire → Acteur via POSSEDE) devrait faire apparaître un miroir de l'autre côté (Acteur ← POSSEDE par un Territoire). Non implémenté dans le proto actuel — à faire.
_Avoid_: symétrie (pas la même chose — la relation n'est pas symétrique, c'est la déclaration d'attente qui l'est)

### Identifiants et clés

**Clé immutable**:
La clé technique d'une propriété dans le Schéma (`annee_construction`, `egid`). Ne change plus après création — préserve les Mappings et Patterns qui la référencent. Concept interne à Rhiza.
_Avoid_: identifiant (trop générique)

**Clé naturelle**:
Propriété marquée `natural_key` dans le Schéma. Identifiant stable attribué par une autorité externe, reconnu universellement. Sert de pivot pour réconcilier les imports successifs sans dépendre des UUID internes.
_Avoid_: clé primaire (concept SQL, pas la même chose)

**EGID**:
Identifiant fédéral de bâtiment (Eidgenössischer Gebäudeidentifikator). Clé naturelle portée par les nœuds `:Territoire` de sous-type Bâtiment. Attribué par l'OFS via le RegBL.

**EGRID**:
Identifiant fédéral de bien-fonds (Eidgenössischer Grundstücksidentifikator). Clé naturelle portée par les nœuds `:Territoire` de sous-type Parcelle. Attribué par le registre foncier cantonal.

### Architecture de données — cinq principes

1. **Le graphe ne stocke pas, il interprète.** Neo4j porte les nœuds (avec identifiant partagé) et les relations (avec confidence/source/date). Rien d'autre. PostgreSQL/PostGIS stocke les propriétés intrinsèques versionnées et les géométries.
2. **L'interprétation a trois dimensions.** Mapping (vocabulaire — champ → propriété), Matching (identification — enrichir ou créer), Patterns (structure — champ → relation).
3. **Le Matching est le seul acte qui demande un jugement.** Il décide, entrée par entrée, si un enregistrement enrichit un nœud existant ou en crée un nouveau. Le Mapping et les Patterns sont mécaniques.
4. **L'ordre n'est pas un bug, c'est du sens.** Un graphe incomplet est légitime. Les zones vides révèlent l'architecture de l'invisibilité.
5. **L'ontologie est un vocabulaire, pas une contrainte.** Elle guide l'interprétation, elle ne l'empêche pas.

**PostgreSQL/PostGIS**:
Source de vérité pour les données factuelles. Tables bi-temporelles versionnées : propriétés intrinsèques (année, surface, EGID, loyer, classe énergétique), géométries, provenance (source, confidence, date, valid_from, valid_to). Multi-source = plusieurs lignes par entité/propriété.
_Avoid_: base secondaire, cache

**Neo4j**:
Source de vérité pour la structure relationnelle. Nœuds avec identifiant partagé + labels de type principal. Relations avec confidence/source/date comme propriétés d'arête. Ne stocke pas les propriétés intrinsèques ni les géométries.
_Avoid_: base de stockage, entrepôt de données

**Labels Neo4j**:
Les quatre types principaux (`:Territoire`, `:Acteur`, `:Flux`, `:Décision`) sont des labels Neo4j — structurels, jamais changés de famille. Les sous-types à l'intérieur d'un type principal (ex: `Acteur:Humain:Personne_morale:Droit_public:Communal`) vivent comme propriété versionnée bi-temporelle dans PostgreSQL. Les labels reflètent le présent (rapide), la propriété reflète l'historique (expressive).

**Pont**:
Identifiant partagé entre PostgreSQL et Neo4j pour relier les deux bases. EGRID pour les parcelles, EGID pour les bâtiments, UUID interne pour les nœuds sans identifiant fédéral. D'autres jeux de données introduiront des identifiants fortement partagés dans la réalité (IDE pour les entreprises, numéro OFS pour les communes, etc.) — chacun est une clé naturelle potentielle qui peut servir de pont. Le backend Node.js+Fastify assemble les deux bases.

### Roadmap

**Sprint** (1, 2, 3):
Unité de livraison de la roadmap spirale. Chaque Sprint traverse toute la chaîne (données → graphe → API → visualisation → terrain) et a un Milestone clair. Sprint 1 = un nœud vivant bout en bout. Sprint 2 = 10 nœuds, 3 vues, saisie réelle. Sprint 3 = 50 nœuds, première abduction documentée.
_Avoid_: itération (trop générique), phase (implique une cascade)

**Parcours** (1–8):
Fonctionnalité utilisateur, pas unité de livraison. Artefact de développement du proto v2 — les références dans le code (ex: "parcours 5 §I6") sont historiques et seront nettoyées. P1 Structurer · P2 Importer · P3 Consulter · P4 Éditer · P5 Schéma · P6 Archiver/Restaurer · P7 Administrer · P8 Territoires transversaux.
_Avoid_: sprint (qui est l'unité de livraison, pas la fonctionnalité)

**Utilisateur**:
Personne qui se connecte à Rhiza (compte dans `config.users`, rôle hiérarchique). Distinct d'un Acteur même si la même entité réelle peut être les deux.
_Avoid_: acteur (quand on parle de l'outil)

## Relationships

- Un **Territoire** contient d'autres **Territoires** (hiérarchie fractale : Suisse → Canton → Commune → Quartier → Parcelle → Bâtiment → Logement → Pièce)
- Un **Acteur** possède, habite ou utilise un **Territoire**
- Un **Acteur** décide sur une **Décision**
- Une **Décision** impacte un **Territoire** ou un **Acteur**
- Un **Flux** traverse un **Territoire** (quand le Flux est un nœud infrastructure)
- Un **Flux** qualifie une relation entre nœuds (quand le Flux est une propriété d'arête)
- Une **Source** alimente le graphe via un **Mapping** (champ → propriété) et des **Patterns** (champ → relation)
- Le **Schéma** définit les propriétés et les **Arêtes attendues** de chaque type — il rend le Mapping et les Patterns possibles
- **PostgreSQL** stocke les faits versionnés, **Neo4j** stocke la structure relationnelle, le **Pont** les relie

## Example dialogue

> **Dev :** "Quand on importe un WFS de bâtiments, le champ `GBAUJ` va dans le Mapping ou dans un Pattern ?"
> **Jo :** "Mapping. C'est une propriété intrinsèque du bâtiment — année de construction. Le Mapping associe `GBAUJ` à la clé `annee_construction` dans le Schéma."

> **Dev :** "Et le champ `EGRID` de la même source ?"
> **Jo :** "Pattern. L'EGRID identifie la parcelle — c'est une relation CONTENU_DANS vers un Territoire de sous-type Parcelle. Le Pattern dit : si un Territoire avec cet EGRID existe, lier ; sinon, créer."

> **Dev :** "Le Service de l'urbanisme est un Acteur ou un Utilisateur ?"
> **Jo :** "Les deux, mais pas au même sens. Le Service de l'urbanisme comme institution est un Acteur dans le graphe — il possède du pouvoir, il prend des Décisions. Marie Dupont qui se connecte à Rhiza est une Utilisatrice — elle a un compte, un rôle, des droits par territoire."

## Flagged ambiguities

- **Territoire** (majuscule) vs **territoire** (minuscule) — résolu : Territoire = espace réel observé. `:Territoire` (avec préfixe label) = nœud du graphe. La distinction se fait par contexte.
- **Flux nœud** vs **Flux arête** — résolu : le Flux se manifeste de deux manières. Infrastructure dédiée = nœud. Ressource qui circule entre nœuds = propriété d'arête.
- **Schéma** vs **Ontologie** — résolu : l'Ontologie est la vision (quoi modéliser — 4 types, 9 relations). Le Schéma est le blueprint pratique (quelles propriétés, quelles arêtes attendues pour chaque type).
- **Mapping** vs **Pattern** — résolu : Mapping = champ → propriété (attribut). Pattern = champ → relation (arête). Ne jamais interchanger.
- **Bidirectionnalité** — concept défini mais non implémenté dans le proto actuel. À faire.
- **Parcours** — artefact de développement, pas terme de domaine. Les références dans le code seront nettoyées.

