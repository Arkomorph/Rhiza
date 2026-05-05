-- Rhiza — Audit du Schéma (Décision Q, Jalon 6)
-- Trace toute mutation du Schéma : qui, quand, quelle ressource, avant/après.
-- Un audit ne s'archive pas — pas de archived_at.

CREATE TABLE IF NOT EXISTS config.schema_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor          TEXT NOT NULL DEFAULT 'jo',
  action         TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  resource_type  TEXT NOT NULL CHECK (resource_type IN ('types', 'properties', 'edges', 'edge_properties', 'expected_edges')),
  resource_id    TEXT NOT NULL,
  before         JSONB,
  after          JSONB,
  source         TEXT NOT NULL CHECK (source IN ('api', 'seed', 'migration'))
);

CREATE INDEX IF NOT EXISTS idx_schema_audit_resource
  ON config.schema_audit (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_schema_audit_date
  ON config.schema_audit (occurred_at DESC);
