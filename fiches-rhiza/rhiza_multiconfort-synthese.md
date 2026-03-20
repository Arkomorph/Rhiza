# Synthèse MultiConfort — Compréhension systémique du confort en environnement de travail

## Identité du document

- **Titre** : Synthèse 0 — MultiConfort (anonymisé)
- **Date** : 08.05.2019 (date du fichier)
- **Institution(s)** : non mentionné explicitement (références à « SI » pour la conception et « TRANSFORM » pour les tests terrain)
- **Auteur(s)** : non mentionné (document anonymisé)
- **Type** : Présentation de synthèse (PowerPoint, ~24 slides) — cadre conceptuel et typologique

## Résumé synthétique

Le document construit un cadre systémique du confort au travail en trois volets. Le volet A modélise la dynamique du confort comme une boucle adaptative entre l'individu et son environnement (Ortiz ; Yao, Li, Liu 2009), étendue à un cadre d'analyse « entreprise » intégrant efficacité, efficience, satisfaction et conditions-cadres, illustré par le cas Telenor (Activity Based Working). Le volet B produit une typologie croisée de schémas récurrents : rôles individuels (Anchor, Connector, Gatherer, Navigator), patterns de travail (Ruche, Cellule, Nid, Club), types d'entreprises (van Meel, Fahrländer) et styles hiérarchiques. Le volet C opère le passage de l'individuel au collectif en identifiant la négociation des facteurs ambiants comme enjeu central, et propose un outil IT de suivi de l'état mental (« oneclick.flow ») ainsi qu'une collaboration SI/TRANSFORM pour le développement d'outils de négociation.

## Pertinence pour Rhiza

- **Lecture relationnelle** : Le confort est modélisé comme une *relation dynamique* entre individu, environnement physique, organisation et collectif — pas comme une propriété intrinsèque du bâtiment. C'est précisément le type de lien invisible que Rhiza cherche à révéler.
- **Flux identifiés** : Le document croise trois catégories de flux : énergétiques (consommation liée aux comportements adaptatifs), spatiaux (patterns d'usage, ABW, densité, choix libre du lieu) et psycho-sociaux (satisfaction, stress, état mental, négociation collective).
- **Temporalité** : L'outil « oneclick.flow » propose une mesure longitudinale de l'état mental, couplable au calendrier de travail — une donnée temporelle que Rhiza pourrait spatialiser.
- **Limites** : Document purement conceptuel, sans données empiriques brutes. Les typologies restent abstraites (non rattachées à des lieux ou capteurs réels).

## Acteurs et parties prenantes

| Acteur | Rôle |
|--------|------|
| End users (individus, équipes, départements) | Sujets du confort, agents d'adaptation |
| Facility Managers | Gestion des conditions-cadres physiques |
| Propriétaires de bâtiments | Décideurs infrastructurels |
| Managers | Organisation, « empowerment » des salariés |
| SI (entité non précisée) | Conception de l'outil IT de négociation |
| TRANSFORM (entité non précisée) | Application et test terrain |
| Blakstad (réf.) | Distinction users / actors / stakeholders (p. 4) |
| Telenor (réf.) | Cas d'étude ABW — aménagement spatial libre, mesure de la performance individuelle |
| Doorley & Witthoft 2012 (réf.) | Cadre d'analyse espace de travail collaboratif (propriétés spatiales) |

## Données et méthodes

- **Méthode** : Revue conceptuelle et synthèse typologique. Pas d'enquête empirique ni de mesures dans ce document.
- **Modèles mobilisés** :
  - Dynamique du confort et modèle adaptatif thermique (Ortiz ; Yao, Li, Liu 2009)
  - Théorie du flow — rapport compétences/défis (Csikszentmihalyi, via Dahlén 2008)
  - Cadre d'analyse organisationnel : efficacité / efficience / satisfaction usager / conditions-cadres
  - Typologies spatiales d'entreprises (van Meel ; Fahrländer)
  - Propriétés spatiales collaboratives : actions, tâches, comportements, lieux, ambiance, densité, surface, stockage (Doorley & Witthoft 2012)
- **Outil proposé** : « oneclick.flow » — clic quotidien sur une icône d'état mental, enregistré avec date, visible uniquement par l'individu, idéalement couplé au calendrier de travail personnel.
- **Typologies produites** : Rôles (Anchor, Connector, Gatherer, Navigator) ; patterns de travail (Ruche, Cellule, Nid, Club) ; types d'entreprises (Moderniste, Process, Cellule, Ateliers) ; types hiérarchiques (Leader, Subordonné autonome, Subordonné dépendant).

## Connexions avec les autres projets

| Projet | Connexion |
|--------|-----------|
| **SWICE WP3** | Lien direct : le confort multi-sensoriel et la négociation collective des ambiances sont au cœur de SWICE. MultiConfort fournit le cadre conceptuel (adaptation, satisfaction, stress) que SWICE opérationnalise sur le terrain. |
| **AssistBat** | L'outil « oneclick.flow » et le cadre d'analyse des conditions-cadres pourraient alimenter un assistant bâtiment orienté usager, au-delà de la performance technique. |
| **SooZ** | Les typologies de patterns de travail et d'usage spatial (ABW, densité, surface, stockage) sont directement pertinentes pour la modélisation des zones d'activité. |
| **CityPulse** | Le suivi temporel de l'état mental (oneclick.flow) fait écho à la capture de « pouls » urbain ; la granularité est ici individuelle/bâtiment plutôt que quartier/ville. |
| **ProRen / ecoREN** | Le lien consommation d'énergie — comportements adaptatifs de confort est explicitement modélisé (section A). La rénovation énergétique doit intégrer cette dynamique pour éviter l'effet rebond. |
| **UrbEco** | Connexion indirecte via l'analyse des flux entre vie privée et vie professionnelle et leur inscription spatiale dans le territoire. |

## Questions ouvertes pour Rhiza

1. **Spatialisation des typologies** : Les rôles (Anchor, Navigator…) et patterns (Ruche, Cellule…) sont décrits abstraitement. Comment les rattacher à des données géo-spatiales réelles (plans, capteurs IoT) pour que Rhiza puisse les cartographier ?
2. **Granularité temporelle** : L'outil oneclick.flow propose un suivi journalier. Est-ce suffisant pour capturer les dynamiques de négociation collective, ou faut-il une granularité horaire ou événementielle ?
3. **Échelle territoriale** : Le document reste à l'échelle bâtiment/entreprise. Comment agréger ces micro-dynamiques de confort pour révéler des patterns à l'échelle du quartier ou de la ville ?
4. **Données empiriques manquantes** : Existe-t-il des données issues de MultiConfort (enquêtes, mesures, logs oneclick.flow) qui pourraient être intégrées dans Rhiza ?
5. **Négociation comme relation modélisable** : La section C introduit la « négociation » des facteurs ambiants entre individus. Comment représenter ces micro-négociations comme des arêtes dans le graphe relationnel territorial de Rhiza ?
