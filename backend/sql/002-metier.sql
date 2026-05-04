-- Rhiza — Schéma métier : nœuds typés + propriétés versionnées
-- Idempotent : utilise IF NOT EXISTS partout
--
-- Décisions de référence (Notion, Annexe 02) :
--   A  — une table par type de nœud, schéma metier distinct de config
--   B  — propriétés versionnées dans une table générique (option b+)
--   C  — géométries dans la colonne geom de metier.territoires (SRID 2056)
--   D  — UUID v4 partagé Postgres ↔ Neo4j, généré côté Postgres
--   D11 — PostgreSQL stocke, Neo4j interprète
--   D12 — nature_history = property_name ordinaire dans metier.properties

CREATE SCHEMA IF NOT EXISTS metier;

-- ══════════════════════════════════════════════════════════════════
-- 1. Tables typées des 4 nœuds principaux
-- ══════════════════════════════════════════════════════════════════
-- Chaque nœud a un uuid v4 partagé avec Neo4j (décision D).
-- archived_at remplace le hard delete (parti pris projet).

-- ── Territoires ──────────────────────────────────────────────────
-- Entité spatiale ancrée dans le sol : parcelle, bâtiment, quartier,
-- corridor écologique, espace public.
-- geom en SRID 2056 (LV95, système national suisse) — décision C.

CREATE TABLE IF NOT EXISTS metier.territoires (
  uuid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  geom        GEOMETRY(Geometry, 2056),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_territoires_geom
  ON metier.territoires USING gist (geom);

-- ── Acteurs ──────────────────────────────────────────────────────
-- Entité qui détient du pouvoir ou subit des effets : personne,
-- institution, association, entreprise, coopérative, entité naturelle.
-- Pas de géométrie — un Acteur n'a pas de sol propre.
-- Le multi-typage Territoire + Acteur:Nature (arbre remarquable) est
-- géré côté applicatif, pas par une colonne geom ici.

CREATE TABLE IF NOT EXISTS metier.acteurs (
  uuid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- ── Décisions ────────────────────────────────────────────────────
-- Opérateur temporel : le seul nœud qui produit un delta dans le graphe.
-- decision_date = date réelle de la décision dans le territoire (DATE,
-- pas TIMESTAMPTZ : une décision politique a une date, pas une heure).
-- Distincte de created_at qui est la date d'enregistrement dans Rhiza.

CREATE TABLE IF NOT EXISTS metier.decisions (
  uuid           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            TEXT NOT NULL,
  decision_date  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at    TIMESTAMPTZ
);

-- ── Flux ─────────────────────────────────────────────────────────
-- Entité avec opérateur propre, infrastructure propre, cycle de vie
-- propre (D1). Ex : réseau CAD, fonds de financement, corridor éco.
-- Minimaliste pour Sprint 1 — enrichi quand le terrain l'exige.

CREATE TABLE IF NOT EXISTS metier.flux (
  uuid        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- ══════════════════════════════════════════════════════════════════
-- 2. Propriétés versionnées — table générique (décision B, option b+)
-- ══════════════════════════════════════════════════════════════════
-- node_uuid pointe vers n'importe laquelle des 4 tables typées.
-- Pas de FOREIGN KEY : un FK devrait référencer une table précise,
-- or node_uuid peut être un territoire, un acteur, une décision ou
-- un flux. La cohérence référentielle est assurée côté applicatif —
-- le backend Node.js vérifie que l'uuid existe dans l'une des 4
-- tables avant chaque insertion.
--
-- Multi-source = plusieurs lignes par couple (node_uuid, property_name),
-- chacune avec sa source et sa confiance. La version courante est
-- celle dont valid_to IS NULL.
--
-- nature_history (D12) est une property_name ordinaire dans cette table.
-- Exemple : property_name = 'nature_history',
--           value_text = 'Acteur:Humain:Personne_morale:Droit_public',
--           source = 'RF cantonal', confidence = 'high'.
--
-- Pas de value_geom ici — les géométries vivent dans
-- metier.territoires.geom (décision C). Le multi-source géométrique
-- sera traité dans metier.geometries_versioned si besoin (Sprint 2-3,
-- inscrit en dette d'architecture acceptée).

CREATE TABLE IF NOT EXISTS metier.properties (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_uuid      UUID NOT NULL,
  property_name  TEXT NOT NULL,
  value_text     TEXT,
  value_number   NUMERIC,
  value_json     JSONB,
  source         TEXT,
  confidence     TEXT CHECK (confidence IN ('high', 'medium', 'low', 'inferred')),
  valid_from     TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to       TIMESTAMPTZ
);

-- Propriétés courantes d'un nœud : la requête la plus fréquente
CREATE INDEX IF NOT EXISTS idx_props_current
  ON metier.properties (node_uuid, property_name)
  WHERE valid_to IS NULL;

-- Historique complet d'un nœud (toutes propriétés, toutes versions)
CREATE INDEX IF NOT EXISTS idx_props_node_history
  ON metier.properties (node_uuid);

-- Historique d'un nœud trié par date
CREATE INDEX IF NOT EXISTS idx_props_history
  ON metier.properties (node_uuid, valid_from);
