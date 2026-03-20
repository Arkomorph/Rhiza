# Well-being at Work: Applying a Novel Approach to Comfort Elicitation (Multiconfort)

## Identité du document

| Champ | Valeur |
|---|---|
| **Titre** | Well-being at Work: Applying a Novel Approach to Comfort Elicitation |
| **Date** | Non mentionné explicitement (références jusqu'à 2020–2021 ; publication estimée ~2021) |
| **Institutions** | HES-SO — Haute école d'ingénierie et d'architecture de Fribourg (HEIA-FR) ; Smart Living Lab (SLL) |
| **Auteurs** | Sandy Ingram, Uchendu Nwachukwu, Nicole Jan, Jean-Philippe Bacher, Florinel Radu |
| **Type** | Article scientifique (conférence HCI), avec prototype proof-of-concept et évaluation empirique |

## Résumé synthétique

Le projet Multiconfort propose un modèle conceptuel systémique pour éliciter et optimiser le confort au travail de bureau, dépassant l'approche classique centrée sur le seul confort thermique. Trois dimensions sont distinguées : environnement physique (température, lumière, bruit, qualité de l'air), social (soutien hiérarchique, échanges, autonomie) et travail (difficulté des tâches, résultats vs attentes). Le processus est cyclique : collecte subjective par émotion dominante, collecte objective par capteurs, analyse automatique de corrélations, reporting dynamique (heatmaps, radar charts), puis négociation collective de mesures adaptatives. Un prototype mobile-first a été développé et connecté à l'infrastructure BBDATA du Smart Living Lab. L'évaluation de 3 semaines avec 7 utilisateurs pilotes (questionnaire UEQ) montre une bonne acceptabilité pragmatique mais un déficit de stimulation hédonique, attribué à un reporting insuffisamment mis en avant et à un échantillon trop restreint pour exploiter les fonctions collectives.

## Pertinence pour Rhiza

- **Flux de confort comme flux territorial** : Le modèle traite le confort comme un flux dynamique et multidimensionnel dans un espace habité. Cette logique est transposable à l'échelle du bâtiment ou du quartier, où Rhiza cherche à révéler les relations entre flux énergétiques, sociaux et d'usage.
- **Croisement données subjectives / objectives** : La confrontation systématique entre ressenti des occupants et mesures physiques (température, bruit, luminosité) via BBDATA constitue un cas d'usage exemplaire pour la couche relationnelle de Rhiza — elle montre comment relier des données de nature différente sur un même lieu et en tirer des indicateurs d'écart significatifs.
- **Dimension temporelle** : Le cycle élicitation–analyse–reporting–adaptation est intrinsèquement temporel et itératif, en cohérence avec la dimension « temporalité » de Rhiza.
- **Négociation collective comme gouvernance micro-territoriale** : Le confort collectif négocié entre occupants d'un même espace est une forme de gouvernance participative, pertinente pour les réflexions de Rhiza sur la propriété d'usage et les dynamiques de cohabitation dans les processus de planification urbaine multi-acteurs.
- **Ancrage Smart Living Lab** : Le prototype est ancré dans l'écosystème SLL de Fribourg, terrain et infrastructure partagés avec d'autres projets du réseau Rhiza.

## Acteurs et parties prenantes

| Acteur | Rôle |
|---|---|
| **Sandy Ingram** (HEIA-FR) | HCI, design d'interaction, lead du projet |
| **Uchendu Nwachukwu** (HEIA-FR) | Recherche HCI |
| **Nicole Jan** (HEIA-FR) | Sciences sociales |
| **Jean-Philippe Bacher** (HEIA-FR) | Smart buildings, énergie |
| **Florinel Radu** (HEIA-FR) | Énergie, bâtiments intelligents |
| **Smart Living Lab (SLL)** | Financement, infrastructure BBDATA, terrain d'expérimentation |
| **Anthony Cherbuin, Martin Spoto, Ryan Siow, Yael Iseli, Joëlle Rudaz** | Développement de l'application |
| **7 utilisateurs pilotes** | Évaluation en conditions réelles (bureaux SLL, 3 semaines) |

## Données et méthodes

| Aspect | Description |
|---|---|
| **Données objectives** | Capteurs Aeotec Multisensor (température, humidité, bruit, luminosité) — relevés toutes les 15 minutes, stockés dans BBDATA via API REST |
| **Données subjectives** | Application mobile-first : élicitation par émotion dominante et facteur d'influence dominant par dimension (échelle 4 points pour le bien-être général, puis choix de dimension, polarité émotionnelle, facteur dominant). Deux modes : questionnaire pas-à-pas et grille en page unique |
| **Reporting** | Heatmaps temporelles (jour/semaine/mois/saison) et radar charts (individu vs groupe), configurables par période, salle, thème et facteur |
| **Évaluation** | User Experience Questionnaire (UEQ, version longue, 26 items, 6 catégories). Étude de 3 semaines, 7 participants, 4 capteurs dans des bureaux à 1–2 occupants |
| **Méthode conceptuelle** | Modèle systémique combinant approche adaptative (issue du confort thermique) et approche holistique, avec intégration explicite de composants numériques (collecteur, analyseur, rapporteur) |
| **Analyse** | Statistiques descriptives uniquement dans le prototype actuel ; détection de patterns et analyse prédictive planifiées comme travaux futurs |
| **Données géographiques** | Non mentionné (localisé au Smart Living Lab, Fribourg) |
| **Données foncières / cadastrales** | Non mentionné |

## Connexions avec les autres projets

| Projet | Connexion |
|---|---|
| **SWICE WP3** | Lien direct — ancrage commun au Smart Living Lab et à BBDATA. L'approche de négociation collective du confort informe les scénarios de confort adaptatif dans les bâtiments intelligents de SWICE. Complémentarité d'échelle : Multiconfort au poste de travail, SWICE au quartier |
| **AssistBat** | L'élicitation subjective du confort pourrait compléter les diagnostics techniques d'AssistBat avec la perception des occupants, notamment pour évaluer l'impact réel des rénovations sur le vécu |
| **SooZ** | Convergence sur la conscientisation et l'awareness par interfaces persuasives ; croisement possible entre patterns de confort au travail et données de mobilité/usage |
| **CityPulse** | Le reporting dynamique par heatmap et la confrontation objectif/subjectif à l'échelle du bâtiment préfigurent un monitoring urbain temps réel applicable à CityPulse |
| **ProRen / ecoREN** | La dimension « confort global » (au-delà du thermique) est un argument central pour justifier et évaluer les rénovations énergétiques. Le modèle pourrait mesurer le confort post-rénovation |
| **UrbEco** | Lien indirect — le modèle multidimensionnel (physique, social, organisationnel) offre un cadre transposable à l'écologie urbaine où dimensions environnementales et sociales s'entremêlent |

## Questions ouvertes pour Rhiza

1. **Passage à l'échelle territoriale** : Le modèle est conçu pour le bureau. Comment transposer l'élicitation par émotion dominante à l'échelle du quartier ou de la ville, où les dimensions de confort sont plus diffuses et les acteurs plus nombreux ?
2. **Interopérabilité BBDATA** : Les données capteurs du SLL sont accessibles via API REST. Rhiza peut-elle se connecter à BBDATA pour croiser données de confort bâtiment avec des données territoriales (mobilité, énergie, écologie) ?
3. **Écart objectif/subjectif comme indicateur relationnel** : Le modèle identifie les écarts entre mesures physiques et perception comme un signal significatif. Rhiza pourrait-elle systématiser ce type d'indicateur à l'échelle urbaine (ex. : température mesurée vs îlot de chaleur perçu, bruit mesuré vs gêne ressentie) ?
4. **Négociation collective et planification** : Le mécanisme awareness → négociation → adaptation est central dans Multiconfort. Comment Rhiza pourrait-elle faciliter ce cycle entre acteurs de la planification urbaine (propriétaires, locataires, communes, cantons) ?
5. **Analyseur prédictif** : Le projet annonce des travaux futurs sur la détection de patterns et la prédiction. Ces algorithmes, s'ils sont développés, pourraient-ils alimenter un module prédictif de Rhiza pour anticiper les tensions territoriales ?
6. **Chatbot comme interface de médiation** : Le projet envisage des agents conversationnels pour communiquer les signaux d'alerte de confort. Rhiza pourrait-elle intégrer une interface similaire pour faciliter la lecture du territoire par des non-experts ?
