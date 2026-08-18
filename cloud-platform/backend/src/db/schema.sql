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
