-- Rhiza — Tables d'authentification et d'audit
-- Idempotent : utilise IF NOT EXISTS partout

CREATE SCHEMA IF NOT EXISTS config;

-- ── Utilisateurs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config.users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  email         TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'lecteur'
    CHECK (role IN ('super_admin','admin_bureau','admin_local','contributeur','lecteur')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Droits par territoire (extension point, vide pour l'instant) ──
CREATE TABLE IF NOT EXISTS config.user_territory_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES config.users(id) ON DELETE CASCADE,
  territory_id  TEXT NOT NULL,
  role          TEXT NOT NULL
    CHECK (role IN ('admin_local','contributeur','lecteur')),
  granted_by    UUID REFERENCES config.users(id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, territory_id)
);

-- ── Sessions (refresh tokens) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS config.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES config.users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  user_agent    TEXT,
  ip_address    INET,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON config.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON config.sessions(token_hash);

-- ── Journal d'audit ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config.audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID REFERENCES config.users(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     TEXT,
  detail        JSONB,
  ip_address    INET,
  request_id    TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON config.audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON config.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON config.audit_log(action);
