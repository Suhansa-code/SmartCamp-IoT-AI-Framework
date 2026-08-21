-- ============================================================================
-- SmartCamp Cloud Backend — PostgreSQL schema
-- Education domain (PAGES alerts). Idempotent: safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS children (
  child_id        TEXT PRIMARY KEY,
  res_id          TEXT,
  camp_id         TEXT NOT NULL,
  grade           INTEGER,
  language        TEXT,
  baseline_score  REAL,
  total_sessions  INTEGER,
  alert_status    TEXT
);

CREATE INDEX IF NOT EXISTS idx_children_camp ON children (camp_id);

CREATE TABLE IF NOT EXISTS sessions (
  session_id      TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL REFERENCES children (child_id),
  composite_score REAL,
  anomaly_flagged SMALLINT DEFAULT 0,
  alert_triggered SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions (child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions (created_at);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id        TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL REFERENCES children (child_id),
  res_id          TEXT,
  camp_id         TEXT NOT NULL,
  alert_type      TEXT,
  trigger_detail  JSONB,
  triggered_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending',
  resolved_at     TIMESTAMPTZ,
  resolved_notes  TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_camp ON alerts (camp_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered ON alerts (triggered_at);

-- ============================================================================
-- Disaster domain (camp + gauging-station details). Table name is deliberately
-- quoted uppercase ("CAMPS") to match the existing Neon deployment.
-- ALTER ... IF NOT EXISTS keeps older DBs compatible when new columns are added.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "CAMPS" (
  id          TEXT PRIMARY KEY,
  code        TEXT UNIQUE,
  name        TEXT,
  lat         NUMERIC(9,6),
  lng         NUMERIC(9,6),
  status      TEXT,
  displaced   INTEGER,
  capacity    INTEGER,
  aid         INTEGER,
  type        TEXT,
  workers     INTEGER,
  water_path  TEXT,
  river       TEXT,
  station     TEXT,
  st_dist     INTEGER,
  up_dist     INTEGER,
  wl          NUMERIC(7,2),
  rain        NUMERIC(7,2),
  alert_l     NUMERIC(7,2),
  minor_l     NUMERIC(7,2),
  major_l     NUMERIC(7,2),
  gau_lat     NUMERIC(9,6),
  gau_lng     NUMERIC(9,6),
  fc_lat      NUMERIC(9,6),
  fc_lng      NUMERIC(9,6),
  elev        INTEGER,
  min_t       NUMERIC(5,2),
  max_t       NUMERIC(5,2),
  hum         INTEGER,
  precip      NUMERIC(7,2),
  max_hr_prec NUMERIC(7,2),
  max_wind    INTEGER,
  avg_wind    INTEGER,
  soil        NUMERIC(5,3),
  pres        INTEGER,
  cloud       INTEGER
);

ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS water_path  TEXT;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS river       TEXT;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS station     TEXT;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS st_dist     INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS up_dist     INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS wl          NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS rain        NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS alert_l     NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS minor_l     NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS major_l     NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS gau_lat     NUMERIC(9,6);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS gau_lng     NUMERIC(9,6);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS fc_lat      NUMERIC(9,6);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS fc_lng      NUMERIC(9,6);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS elev        INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS min_t       NUMERIC(5,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS max_t       NUMERIC(5,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS hum         INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS precip      NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS max_hr_prec NUMERIC(7,2);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS max_wind    INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS avg_wind    INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS soil        NUMERIC(5,3);
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS pres        INTEGER;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS cloud       INTEGER;
