-- ─── 007 — Table d'audit métier ──────────────────────────────────────
-- Jalon 6.5 Sprint 2 — Observabilité unifiée
-- Séparée de config.schema_audit : ici on trace les mutations sur les
-- entités métier (territoires, acteurs, décisions, flux).
-- La colonne source_id anticipe J8b (moteur d'exécution pipeline).

CREATE TABLE IF NOT EXISTS metier.audit (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor         TEXT NOT NULL DEFAULT 'jo',
  action        TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  resource_type TEXT NOT NULL CHECK (resource_type IN ('territoires', 'acteurs', 'decisions', 'flux')),
  resource_uuid UUID NOT NULL,
  before        JSONB,
  after         JSONB,
  source        TEXT NOT NULL CHECK (source IN ('api', 'seed', 'migration', 'pipeline')),
  source_id     TEXT REFERENCES config.sources(id),
  execution_id  BIGINT REFERENCES config.source_executions(id)
);

CREATE INDEX IF NOT EXISTS idx_metier_audit_resource ON metier.audit (resource_type, resource_uuid);
CREATE INDEX IF NOT EXISTS idx_metier_audit_date ON metier.audit (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_metier_audit_execution ON metier.audit (execution_id) WHERE execution_id IS NOT NULL;
