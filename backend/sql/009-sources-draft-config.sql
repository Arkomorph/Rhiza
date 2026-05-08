-- ─── 009 — Draft config JSONB sur sources ────────────────────────────
-- Jalon 8b Sprint 2 — Persistance de la configuration du stepper
-- (mapping, patterns, fichier, etc.) dans la source elle-même.
-- Survit au refresh navigateur.

ALTER TABLE config.sources ADD COLUMN IF NOT EXISTS draft_config JSONB DEFAULT '{}';
