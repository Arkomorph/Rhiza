-- Rhiza — Schéma de configuration : ontologie persistante
-- Idempotent : IF NOT EXISTS partout
--
-- Décisions de référence (Feuille de route Sprint 2) :
--   E — 6 tables config.schema_*
--   F — is_locked sur types (4 racines) et edges (9 arêtes), validation applicative
--   G — archived_at sur expected_edges et properties uniquement
--   H — seed one-shot depuis les constantes JS frontend

-- ═══════════════════════════════════════════════════════════════════
-- 1. Types de nœuds — arbre hiérarchique (4 racines + sous-types)
-- ═══════════════════════════════════════════════════════════════════
-- parent_key NULL = type racine.
-- is_locked = true pour les 4 types principaux (Territoire, Acteur, Flux, Décision).
-- Validation applicative dans les routes : PATCH/DELETE rejeté si is_locked.

CREATE TABLE IF NOT EXISTS config.schema_types (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  parent_key  TEXT REFERENCES config.schema_types(key),
  description TEXT,
  is_locked   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. Propriétés intrinsèques par type de nœud
-- ═══════════════════════════════════════════════════════════════════
-- Héritage parent → enfant calculé applicativement (pas de duplication SQL).
-- archived_at pour conserver la traçabilité si une source historique
-- référence une propriété dans ses mappings.

CREATE TABLE IF NOT EXISTS config.schema_properties (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key     TEXT NOT NULL REFERENCES config.schema_types(key),
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  data_type    TEXT NOT NULL,
  required     BOOLEAN NOT NULL DEFAULT false,
  natural_key  BOOLEAN NOT NULL DEFAULT false,
  enum_values  JSONB,
  geom_kind    TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schema_props_unique
  ON config.schema_properties (type_key, key)
  WHERE archived_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Types d'arêtes — les 9 relations de l'ontologie
-- ═══════════════════════════════════════════════════════════════════
-- Toutes verrouillées (is_locked = true). Seule modification possible :
-- migration SQL explicite. from_type et to_type pointent vers les
-- types racines (Territoire, Acteur, Flux, Décision).

CREATE TABLE IF NOT EXISTS config.schema_edges (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  from_type   TEXT NOT NULL REFERENCES config.schema_types(key),
  to_type     TEXT NOT NULL REFERENCES config.schema_types(key),
  description TEXT,
  is_locked   BOOLEAN NOT NULL DEFAULT true
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. Propriétés spécifiques par arête
-- ═══════════════════════════════════════════════════════════════════
-- Propriétés propres à chaque type d'arête (ex: regime sur Possède,
-- montant sur Finance/reçoit). Les 6 propriétés universelles
-- (source, confidence, date, valid_from, valid_to, exec_id) vivent
-- dans une table séparée — cf. schema_universal_edge_properties.

CREATE TABLE IF NOT EXISTS config.schema_edge_properties (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_key    TEXT NOT NULL REFERENCES config.schema_edges(key),
  key         TEXT NOT NULL,
  label       TEXT NOT NULL,
  data_type   TEXT NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT false,
  enum_values JSONB,
  notes       TEXT,
  UNIQUE (edge_key, key)
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. Propriétés universelles d'arête (héritées par toutes les arêtes)
-- ═══════════════════════════════════════════════════════════════════
-- 6 propriétés (source, confidence, date, valid_from, valid_to, exec_id)
-- qui s'appliquent à toutes les arêtes sans exception.
-- Table séparée : une prop universelle n'appartient à aucune arête
-- en particulier. Jointure applicative au moment de servir le frontend.

CREATE TABLE IF NOT EXISTS config.schema_universal_edge_properties (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  data_type   TEXT NOT NULL,
  required    BOOLEAN NOT NULL DEFAULT false,
  enum_values JSONB,
  notes       TEXT
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. Arêtes attendues par type (expected edges)
-- ═══════════════════════════════════════════════════════════════════
-- Versioning léger (Décision G) : created_at + archived_at.
-- Héritage parent → enfant calculé applicativement.
-- target_type pointe vers la clé feuille (ex: "Commune", pas
-- "Territoire:Commune") — tient tant que les clés sont globalement
-- uniques (dette inscrite).

CREATE TABLE IF NOT EXISTS config.schema_expected_edges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key       TEXT NOT NULL REFERENCES config.schema_types(key),
  edge_key       TEXT NOT NULL REFERENCES config.schema_edges(key),
  direction      TEXT NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
  target_type    TEXT NOT NULL REFERENCES config.schema_types(key),
  obligation     TEXT NOT NULL CHECK (obligation IN ('hard', 'soft')),
  multiplicity   TEXT NOT NULL CHECK (multiplicity IN ('one', 'many')),
  default_mode   TEXT CHECK (default_mode IN ('linkOrCreateField', 'linkOrCreateGeneric', 'disabled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expected_edges_active
  ON config.schema_expected_edges (type_key, edge_key, direction, target_type)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expected_edges_type
  ON config.schema_expected_edges (type_key)
  WHERE archived_at IS NULL;
