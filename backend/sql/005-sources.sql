-- Rhiza — Catalogue des sources de données
-- Intégré depuis feature/sources-catalogue + ajustements J8a :
--   - target_type FK vers config.schema_types(key) (NULLable)
--   - archived_at pour archivage logique (DELETE = set archived_at)
-- Idempotent : IF NOT EXISTS partout

CREATE TABLE IF NOT EXISTS config.sources (
  id                TEXT PRIMARY KEY,
  nom               TEXT NOT NULL,
  format            TEXT,
  portail           TEXT,
  theme             TEXT,
  indicators        TEXT,
  producer          TEXT,
  year              INTEGER,
  grain             TEXT,
  extent            TEXT,
  url               TEXT,
  access            TEXT,
  status            TEXT NOT NULL DEFAULT 'brouillon'
    CHECK (status IN ('brouillon','configuree','en_service','erreur')),
  endpoint_url      TEXT,
  endpoint_protocol TEXT,
  complet           BOOLEAN NOT NULL DEFAULT false,
  target_type       TEXT REFERENCES config.schema_types(key),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sources_format ON config.sources(format);
CREATE INDEX IF NOT EXISTS idx_sources_portail ON config.sources(portail);
CREATE INDEX IF NOT EXISTS idx_sources_status ON config.sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_target_type ON config.sources(target_type)
  WHERE archived_at IS NULL;

-- Historique des exécutions d'import
CREATE TABLE IF NOT EXISTS config.source_executions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       TEXT NOT NULL REFERENCES config.sources(id) ON DELETE CASCADE,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by     UUID REFERENCES config.users(id),
  summary         TEXT,
  changes         JSONB NOT NULL DEFAULT '[]',
  auto_decisions  JSONB NOT NULL DEFAULT '[]',
  geom_summary    JSONB NOT NULL DEFAULT '[]',
  duration_ms     INTEGER,
  success         BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_executions_source ON config.source_executions(source_id);
CREATE INDEX IF NOT EXISTS idx_executions_date ON config.source_executions(executed_at DESC);
