-- ─── 008 — success NULLable dans source_executions ───────────────────
-- Jalon 8b Sprint 2 — Moteur d'exécution minimal
-- Permet l'INSERT initial avec success = NULL (exécution en cours).
-- UPDATE à la fin avec success = true|false.

ALTER TABLE config.source_executions ALTER COLUMN success DROP NOT NULL;
ALTER TABLE config.source_executions ALTER COLUMN success DROP DEFAULT;
