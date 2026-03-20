# CityPulse - Schema Flow Maquette

## Identite du document
- **Titre** : CityPulse - Schema Flow Maquette ("Rendre visibles les pulsations de la ville")
- **Date** : 20 mars 2019
- **Auteur(s)** : JPA
- **Institution(s)** : Non mentionne explicitement (contexte : HEIA-FR / Smart Living Lab, Fribourg)
- **Type** : Schema technique de flux (diagramme de pipeline logiciel + logique de distribution des flux de mobilite)
- **Fichier source** : 190320_CityPulse_SchemaFlowMaquette.txt

## Resume synthetique
Ce document detaille l'architecture logicielle et la logique de calcul des flux de mobilite du dispositif CityPulse. Il se decompose en trois volets :

1. **Pipeline 3D / scene Unity** : Construction de la scene a partir de geodonnees (GeoTIFF pour le terrain, DWG/ShapeFile pour les routes, trottoirs, places et batiments 3D), enrichie par des textures (diffuse map, normal map, specular map), un systeme d'eclairage dynamique (soleil, nuages) et des couches d'information projetees (densite habitants/emplois, zonage, bruit jour/nuit). L'interface (UI) permet de controler le temps (navigation jour/heure) et de selectionner les couches visibles.

2. **Logique de distribution des flux** (intitulee "CityPulse Logique Flux Transform - JPA - 180927") : Modele matriciel origine/destination entre quatre axes (Marly, Perolles, Wilhelm, Fonderie) et six destinations de stationnement (Fonderie2, Gachoud, HEIA, UNI, WilhelmKaiser, EcoleMetiers). Le calcul distingue stock entrant, stock sortant, transit, et demi-tour (U-turn) avec un taux aleatoire borne (min/max). La distribution du stationnement est proportionnelle a la charge de chaque axe. Les flux sont lus depuis des fichiers XLS/JSON et consommes par des spawners C# (systeme de particules/agents).

3. **Fabrication de la maquette tangible** : Chaine de production allant du terrain (contours, decoupe laser, sablage, collage de couches de plexiglas) aux textures projetees, en passant par le calage spatial (spatial joint) entre la maquette physique (1209x680 mm, echelle 1:1000) et la projection ecran (1920x1080).

## Pertinence pour Rhiza
- **Modele de flux comme precedent** : La logique O/D (origine/destination) entre axes et destinations de stationnement est un prototype concret de lecture relationnelle des flux de mobilite. La structure stock/transit/U-turn offre un vocabulaire reutilisable pour modeliser d'autres types de flux (energie, ecologie).
- **Calcul proportionnel de distribution** : Le mecanisme de repartition proportionnelle des vehicules entrants vers les parkings selon la charge relative de chaque axe constitue une methode transposable a d'autres flux (repartition de consommation energetique par batiment, par exemple).
- **Pipeline de donnees heterogenes** : Le schema documente exhaustivement le passage entre formats (GeoTIFF, DWG, ShapeFile, FBX, XLS, JSON, PNG, PDF) et outils (SIG, 3ds Max, Unity/C#). Cette chaine revele la friction d'integration typique que Rhiza devra gerer.
- **Dimension temporelle** : La navigation par heure et par jour (ChangeTime, DateTimeUpdate) avec impact direct sur les flux et l'environnement (soleil, bruit) est un modele pour la couche "temporalite" de Rhiza.
- **Limite** : Seule la mobilite individuelle motorisee est modelisee. Les flux energetiques, ecologiques et fonciers sont absents.

## Acteurs et parties prenantes
- **Concepteur technique** : JPA (auteur des schemas, mars 2019 ; logique flux datee septembre 2018)
- **Equipe probable** : HEIA-FR / Smart Living Lab (non confirme dans le document)
- **Usagers de la maquette** : Non mentionne
- **Decideurs / acteurs du territoire** : Non mentionne
- **Modes de collaboration** : Non mentionne

## Donnees et methodes
- **Donnees d'entree** :
  - Terrain : GeoTIFF
  - Reseau routier, trottoirs, places : ShapeFile, DWG
  - Batiments 3D : DWG, FBX
  - Textures : PNG (diffuse, normal, specular, road marking)
  - Donnees de flux : XLS (matrices O/D par heure), JSON (spawners)
  - Couches thematiques : densite habitants/emplois, zonage, bruit jour/nuit (formats PDF/PNG)
- **Formats de sortie** : Scene Unity (C#), maquette physique (plexiglas decoupe laser)
- **Echelle spatiale** : Quartier Perolles-Marly-Wilhelm-Fonderie, Fribourg ; 1:1000
- **Echelle temporelle** : Cycle journalier, pas horaire (+/- 1h, +/- 1j), point de depart : lundi 08:00
- **Methodes** :
  - Agents/particules pour la simulation de trafic en temps reel
  - Distribution proportionnelle des flux par axe et par destination de parking
  - Taux de demi-tour (U-turn) par axe avec composante aleatoire (min/max)
  - Calage spatial entre maquette physique et projection numerique (spatial joint)
  - Dictionnaires de chemins (PathLookup) pour le routage des agents

## Connexions avec les autres projets
- **SWICE WP3** : La couche de geodonnees (densite, affectation, bruit) et la dimension temporelle sont directement exploitables comme inputs SWICE. Le modele de flux pourrait etre etendu aux flux energetiques du quartier Perolles.
- **AssistBat** : Les batiments 3D et les affectations du sol sont des donnees partagees. La logique de distribution proportionnelle (stock/parking) est transposable a la repartition de consommation energetique par batiment.
- **SooZ** : La matrice O/D et la logique de transit entre zones sont structurellement proches des analyses de zonage de SooZ.
- **ProRen/ecoREN** : Connexion indirecte via les donnees de densite (dimensionnement reseaux energetiques). La structure temporelle (heure par heure) pourrait alimenter des profils de charge.
- **UrbEco** : Les couches bruit jour/nuit et la simulation de flux vehiculaire sont des inputs directs pour l'analyse d'impact ecologique.
- **Fiche associee** : `rhiza_citypulse-concepts.md` (schema conceptuel du meme projet, 18 mars 2019)

## Questions ouvertes pour Rhiza
- La logique de distribution proportionnelle stock/transit est-elle validee empiriquement (comptages) ou purement theorique ? Les fichiers XLS sources sont-ils accessibles ?
- Le modele est limite a 4 axes et 6 destinations : est-il parametrable pour d'autres perimetres ou d'autres granularites ?
- Le taux de demi-tour (U-turn) repose sur un aleatoire borne : quelle est la sensibilite du modele a ce parametre ? A-t-il ete calibre ?
- Comment etendre cette structure O/D aux flux non motorises (pietons, velos, TP) et aux flux non-mobilite (energie, eau, foncier) ?
- Le pipeline de fabrication de la maquette tangible est-il documente suffisamment pour etre reproduit sur un autre perimetre suisse ?
- Les scripts C# (FluxReader, PathLookup, Spawners) sont-ils archives et accessibles, ou le savoir-faire est-il tacite ?
- Quelle a ete l'utilisation effective de cette maquette en contexte de concertation territoriale ? Quels retours des acteurs ?
