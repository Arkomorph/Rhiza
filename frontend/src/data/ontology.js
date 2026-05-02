// Arbre complet de l'ontologie Rhiza — 4 nœuds racines, sous-types imbriqués, expectedEdges
// Source de vérité initiale — sera copiée en state mutable au démarrage du composant App.
export const INITIAL_ONTOLOGY_TREE = {
  Territoire: {
    key: "Territoire", label: "Territoire",
    description: "Entité spatiale ancrée dans le sol. Géométrie, EGID potentiel, coordonnées.",
    props: [
      { key: "nom", label: "Nom", type: "string", natural_key: false, notes: "Identifiant lisible." },
    ],
    children: {
      Canton: {
        key: "Canton", label: "Canton",
        props: [
          { key: "code", label: "Code cantonal", type: "string", natural_key: true, notes: "Ex. FR, VD, GE." },
          { key: "nom_officiel", label: "Nom officiel", type: "string" },
          { key: "limite", label: "Limite cantonale", type: "geometry", geomKind: "polygon" },
        ],
      },
      Commune: {
        key: "Commune", label: "Commune",
        props: [
          { key: "ofs_id", label: "ID OFS", type: "string", natural_key: true, notes: "Identifiant officiel des communes (BFS-Nr)." },
          { key: "nom_officiel", label: "Nom officiel", type: "string" },
          { key: "population", label: "Population", type: "integer", notes: "STATPOP, mise à jour annuelle." },
          { key: "limite", label: "Limite communale", type: "geometry", geomKind: "polygon" },
        ],
      },
      Quartier: {
        key: "Quartier", label: "Quartier",
        props: [
          { key: "code_statistique", label: "Code statistique", type: "string", natural_key: true },
          { key: "limite", label: "Limite du quartier", type: "geometry", geomKind: "polygon" },
        ],
      },
      Parcelle: {
        key: "Parcelle", label: "Parcelle",
        props: [
          { key: "egrid", label: "EGRID", type: "string", natural_key: true, notes: "Identifiant fédéral des immeubles." },
          { key: "no_parcelle", label: "N° de parcelle", type: "string" },
          { key: "surface", label: "Surface (m²)", type: "float" },
          { key: "empreinte", label: "Empreinte cadastrale", type: "geometry", geomKind: "polygon" },
        ],
        expectedEdges: [
          {
            edgeKey: "ContenuDans", direction: "outgoing", otherSide: ["Territoire", "Commune"],
            obligation: "hard", multiplicity: "one",
            defaultMode: "linkOrCreateGeneric",
            notes: "Toute Parcelle est nécessairement dans une Commune (cadastre suisse).",
          },
          {
            edgeKey: "Possede", direction: "incoming", otherSide: ["Acteur"],
            obligation: "hard", multiplicity: "many",
            defaultMode: "linkOrCreateField",
            notes: "Une Parcelle a toujours au moins un propriétaire (RF cantonal).",
          },
        ],
      },
      "Bâtiment": {
        key: "Bâtiment", label: "Bâtiment",
        props: [
          { key: "egid", label: "EGID", type: "string", natural_key: true, notes: "Identifiant fédéral des bâtiments." },
          { key: "annee_construction", label: "Année construction", type: "integer" },
          { key: "nb_logements", label: "Nombre de logements", type: "integer" },
          { key: "surface_brute", label: "Surface brute (m²)", type: "float" },
          { key: "classe_energetique", label: "Classe énergétique CECB", type: "enum", enum_values: [
            { value: "A", label: "A — très efficient" },
            { value: "B", label: "B — efficient" },
            { value: "C", label: "C — moyen" },
            { value: "D", label: "D — peu efficient" },
            { value: "E", label: "E — médiocre" },
            { value: "F", label: "F — mauvais" },
            { value: "G", label: "G — très mauvais" },
          ], enum_source: "CECB — Certificat énergétique cantonal des bâtiments" },
          { key: "epoque_construction", label: "Époque de construction (RegBL)", type: "enum", enum_values: [
            { value: "8011", label: "Avant 1919", code_externe: { regbl: "8011" } },
            { value: "8012", label: "1919 – 1945", code_externe: { regbl: "8012" } },
            { value: "8013", label: "1946 – 1960", code_externe: { regbl: "8013" } },
            { value: "8014", label: "1961 – 1970", code_externe: { regbl: "8014" } },
            { value: "8015", label: "1971 – 1980", code_externe: { regbl: "8015" } },
            { value: "8016", label: "1981 – 1985", code_externe: { regbl: "8016" } },
            { value: "8017", label: "1986 – 1990", code_externe: { regbl: "8017" } },
            { value: "8018", label: "1991 – 1995", code_externe: { regbl: "8018" } },
            { value: "8019", label: "1996 – 2000", code_externe: { regbl: "8019" } },
            { value: "8020", label: "2001 – 2005", code_externe: { regbl: "8020" } },
            { value: "8021", label: "2006 – 2010", code_externe: { regbl: "8021" } },
            { value: "8022", label: "2011 – 2015", code_externe: { regbl: "8022" } },
            { value: "8023", label: "Après 2015", code_externe: { regbl: "8023" } },
          ], enum_source: "RegBL — Registre fédéral des bâtiments et logements (champ GBAUP)", notes: "On stocke le code RegBL tel quel ; l'affichage utilise le label." },
          { key: "systeme_chauffage", label: "Système de chauffage", type: "string" },
          { key: "position", label: "Position (point d'adresse)", type: "geometry", geomKind: "point" },
          { key: "empreinte", label: "Empreinte au sol", type: "geometry", geomKind: "polygon" },
        ],
        expectedEdges: [
          {
            edgeKey: "ContenuDans", direction: "outgoing", otherSide: ["Territoire", "Parcelle"],
            obligation: "hard", multiplicity: "one",
            defaultMode: "linkOrCreateGeneric",
            notes: "Tout Bâtiment est sur une Parcelle (RegBL ↔ RF). Si la Parcelle n'existe pas, on la crée comme placeholder.",
          },
          {
            edgeKey: "ContenuDans", direction: "outgoing", otherSide: ["Territoire", "Quartier"],
            obligation: "soft", multiplicity: "one",
            defaultMode: "linkOrCreateField",
            notes: "Déductible spatialement via ST_Within(empreinte, quartier.limite).",
          },
          {
            edgeKey: "HabiteUtilise", direction: "incoming", otherSide: ["Acteur", "Humain"],
            obligation: "soft", multiplicity: "many",
            defaultMode: "linkOrCreateGeneric",
            notes: "Bâtiments résidentiels — habitants. Source typique : registres cantonaux.",
          },
        ],
      },
      Logement: {
        key: "Logement", label: "Logement",
        props: [
          { key: "ewid", label: "EWID", type: "string", natural_key: true, notes: "Identifiant fédéral des logements." },
          { key: "nb_pieces", label: "Nombre de pièces", type: "float", notes: "Demi-pièces possibles." },
          { key: "surface", label: "Surface (m²)", type: "float" },
        ],
        expectedEdges: [
          {
            edgeKey: "ContenuDans", direction: "outgoing", otherSide: ["Territoire", "Bâtiment"],
            obligation: "hard", multiplicity: "one",
            defaultMode: "linkOrCreateGeneric",
            notes: "Tout Logement appartient à un Bâtiment (RegBL).",
          },
          {
            edgeKey: "HabiteUtilise", direction: "incoming", otherSide: ["Acteur", "Humain", "Groupe", "Menage"],
            obligation: "soft", multiplicity: "one",
            defaultMode: "linkOrCreateGeneric",
            notes: "Un Logement est habité par un Ménage (occupation principale).",
          },
        ],
      },
      "Pièce": {
        key: "Pièce", label: "Pièce",
        props: [
          { key: "nom", label: "Nom", type: "string" },
          { key: "usage", label: "Usage", type: "enum", enum_values: ["séjour", "chambre", "cuisine", "salle_de_bain", "wc", "rangement", "autre"] },
        ],
      },
    },
  },
  Acteur: {
    key: "Acteur", label: "Acteur",
    description: "Entité qui détient du pouvoir ou subit des effets dans une chaîne causale.",
    props: [
      { key: "nom", label: "Nom", type: "string", natural_key: true, notes: "Identifiant lisible. Source : RF, RegBL, registres officiels, manuel." },
      { key: "notes", label: "Notes", type: "text", notes: "Espace de qualification informelle." },
    ],
    children: {
      Humain: {
        key: "Humain", label: "Humain",
        description: "Acteur humain au sens large — personne, ménage, association, institution.",
        props: [
          { key: "langue_principale", label: "Langue principale", type: "enum", enum_values: ["fr", "de", "it", "rm", "autre"], notes: "Discriminant pour les chaînes communicationnelles en Suisse." },
        ],
        children: {
          Individu: {
            key: "Individu", label: "Individu", description: "Personne physique.",
            props: [
              { key: "tranche_age", label: "Tranche d'âge", type: "enum", enum_source: "OFS STATPOP quinquennal", enum_values: ["0-4","5-9","10-14","15-19","20-24","25-29","30-34","35-39","40-44","45-49","50-54","55-59","60-64","65-69","70-74","75-79","80-84","85-89","90-94","95-99","100+"] },
              { key: "genre", label: "Genre", type: "enum", enum_values: ["f", "m", "autre", "inconnu"] },
              { key: "nationalite", label: "Nationalité", type: "enum", enum_values: ["suisse", "etranger"], notes: "Binaire dans un premier temps." },
            ],
          },
          Groupe: {
            key: "Groupe", label: "Groupe",
            description: "Plus d'un humain, lié par parenté, indivision, droit ou pratique informelle.",
            props: [
              { key: "taille", label: "Taille", type: "integer", notes: "Nombre de membres ou personnes du groupe." },
              { key: "date_constitution", label: "Date de constitution", type: "date", notes: "Quand le groupe est apparu juridiquement ou de fait." },
            ],
            children: {
              Menage: {
                key: "Menage", label: "Ménage", description: "Groupe d'humains partageant un logement (sens OFS).",
                props: [
                  { key: "taille_menage", label: "Taille du ménage", type: "integer", notes: "Sémantique précise OFS STATPOP." },
                  { key: "composition", label: "Composition", type: "enum", enum_source: "OFS niveaux 1+2", enum_values: ["individuel", "familial", "non_familial", "collectif"] },
                ],
              },
              Indivision: {
                key: "Indivision", label: "Indivision", description: "Groupe constitué par succession ou copropriété de fait.",
                props: [
                  { key: "mode_indivision", label: "Mode d'indivision", type: "enum", enum_values: ["hoirie", "copropriete_ppe", "indivision_commerciale", "indivision_simple"] },
                ],
              },
              Personne_morale: {
                key: "Personne_morale", label: "Personne morale",
                description: "Entité formalisée juridiquement.",
                props: [
                  { key: "numero_ide", label: "Numéro IDE", type: "string", natural_key: true, notes: "Format CHE-XXX.XXX.XXX. Source : registre du commerce." },
                  { key: "parapublique", label: "Parapublique", type: "enum", enum_values: ["non", "partiel", "total"], notes: "Capture le statut hybride (CFF, La Poste, BCV) sans créer un sous-type structurel. Défaut : non." },
                  { key: "actif", label: "Actif", type: "boolean", notes: "Une SA radiée garde son nœud mais marquée inactive." },
                ],
                children: {
                  Droit_prive: {
                    key: "Droit_prive", label: "Droit privé", description: "Autorité conférée par les statuts et l'adhésion volontaire.",
                    props: [
                      { key: "forme_juridique", label: "Forme juridique", type: "enum", enum_source: "Codes RC OFS", enum_values: ["sa", "sarl", "snc", "scm", "association", "fondation", "cooperative", "succursale", "individuelle"] },
                    ],
                  },
                  Droit_public: {
                    key: "Droit_public", label: "Droit public", description: "Autorité conférée par la loi.",
                    props: [
                      { key: "forme_juridique", label: "Forme juridique", type: "enum", enum_values: ["commune", "canton", "confederation", "corporation_droit_public", "etablissement_droit_public", "fondation_droit_public"] },
                      { key: "niveau_administratif", label: "Niveau administratif", type: "enum", enum_values: ["communal", "cantonal", "federal", "intercommunal"], notes: "Calcul direct de la profondeur Z (D7)." },
                      { key: "competence", label: "Compétence", type: "list", notes: "Ex : aménagement, énergie, social, fiscalité, mobilité." },
                    ],
                  },
                },
              },
              Collectif_informel: {
                key: "Collectif_informel", label: "Collectif informel",
                description: "Groupe lié par projet, occupation ou réseau, sans formalisation juridique.",
                props: [],
              },
            },
          },
        },
      },
      Nature: {
        key: "Nature", label: "Nature",
        description: "Entité du vivant non-humain représentée comme sujet dans une chaîne décisionnelle.",
        props: [],
        children: {
          Individu_vivant: {
            key: "Individu_vivant", label: "Individu vivant", description: "Animal, arbre remarquable, individu nommé.",
            props: [
              { key: "espece", label: "Espèce", type: "string", notes: "Nom commun ou scientifique." },
              { key: "age_estime", label: "Âge estimé", type: "integer", notes: "En années." },
              { key: "protection", label: "Statut de protection", type: "enum", enum_values: ["remarquable", "protégé", "inventorié", "non"] },
              { key: "localisation_precise", label: "Localisation précise", type: "geometry", geomKind: "point" },
            ],
          },
          Population: {
            key: "Population", label: "Population", description: "Espèce, troupeau, colonie.",
            props: [
              { key: "espece_taxon", label: "Espèce ou groupe taxonomique", type: "string" },
              { key: "effectif_estime", label: "Effectif estimé", type: "integer" },
            ],
          },
          Ecosysteme: {
            key: "Ecosysteme", label: "Écosystème", description: "Corridor, forêt, cours d'eau au sens vivant.",
            props: [
              { key: "type_ecosysteme", label: "Type d'écosystème", type: "enum", enum_values: ["corridor", "cours_d_eau", "foret", "prairie", "biotope", "autre"] },
              { key: "surface", label: "Surface (m²)", type: "float" },
            ],
          },
        },
      },
    },
  },
  Flux: {
    key: "Flux", label: "Flux",
    description: "Mouvement matériel ou immatériel qui précède et conditionne une relation entre deux nœuds.",
    props: [],
  },
  "Décision": {
    key: "Décision", label: "Décision",
    description: "Opérateur de changement topologique intentionnel dans la réalité humaine du territoire.",
    props: [],
    expectedEdges: [
      {
        edgeKey: "DecideSur", direction: "incoming", otherSide: ["Acteur"],
        obligation: "hard", multiplicity: "many",
        defaultMode: "linkOrCreateField",
        notes: "Toute Décision est émise par au moins un Acteur (signataire, rapporteur, votant).",
      },
      {
        edgeKey: "Impacte", direction: "outgoing", otherSide: ["Territoire"],
        obligation: "soft", multiplicity: "many",
        defaultMode: "linkOrCreateField",
        notes: "Application directe sur un ou plusieurs Territoires (parcelles, quartiers, etc.).",
      },
    ],
  },
};
