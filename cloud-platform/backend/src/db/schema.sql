-- ============================================================================
-- SmartCamp Cloud Backend — PostgreSQL schema
-- Idempotent: safe to run repeatedly.
-- ============================================================================

-- ── Education domain (existing) ───────────────────────────────────────────

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

-- ── Disaster domain ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CAMPS" (
  id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT,
  lat NUMERIC(9,6), lng NUMERIC(9,6), status TEXT,
  displaced INTEGER, capacity INTEGER, aid INTEGER, type TEXT, workers INTEGER,
  water_path TEXT, river TEXT, station TEXT, st_dist INTEGER, up_dist INTEGER,
  wl NUMERIC(7,2), rain NUMERIC(7,2), alert_l NUMERIC(7,2),
  minor_l NUMERIC(7,2), major_l NUMERIC(7,2),
  gau_lat NUMERIC(9,6), gau_lng NUMERIC(9,6),
  fc_lat NUMERIC(9,6), fc_lng NUMERIC(9,6), elev INTEGER,
  min_t NUMERIC(5,2), max_t NUMERIC(5,2), hum INTEGER,
  precip NUMERIC(7,2), max_hr_prec NUMERIC(7,2),
  max_wind INTEGER, avg_wind INTEGER, soil NUMERIC(5,3), pres INTEGER, cloud INTEGER
);

-- ── Resource domain (synced from Raspberry Pi via MQTT) ──────────────────

CREATE TABLE IF NOT EXISTS persons (
  id                    INTEGER PRIMARY KEY,
  fingerprint_id        TEXT UNIQUE NOT NULL,
  full_name             TEXT NOT NULL,
  age                   INTEGER NOT NULL,
  gender                TEXT,
  family_unit_id        TEXT,
  family_size           INTEGER DEFAULT 1,
  is_pregnant           SMALLINT DEFAULT 0,
  has_chronic_illness   SMALLINT DEFAULT 0,
  medical_notes         TEXT,
  person_type           TEXT DEFAULT 'refugee',
  is_active             SMALLINT DEFAULT 1,
  registration_date     TEXT,
  mqtt_client_id        TEXT,
  mqtt_password         TEXT,
  created_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_persons_fingerprint ON persons (fingerprint_id);

CREATE TABLE IF NOT EXISTS camp_checkins (
  id              INTEGER PRIMARY KEY,
  person_id       INTEGER REFERENCES persons(id),
  checkin_time    TIMESTAMPTZ,
  camp_day        INTEGER DEFAULT 1,
  is_new_arrival  SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_checkins_person ON camp_checkins (person_id);

CREATE TABLE IF NOT EXISTS wristbands (
  id              INTEGER PRIMARY KEY,
  person_id       INTEGER REFERENCES persons(id),
  barcode         TEXT UNIQUE NOT NULL,
  qr_identifier   TEXT,
  status          TEXT DEFAULT 'AVAILABLE',
  issued_at       TIMESTAMPTZ,
  assigned_at     TIMESTAMPTZ,
  is_active       SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_wristbands_barcode ON wristbands (barcode);

CREATE TABLE IF NOT EXISTS wristband_assignments (
  id              INTEGER PRIMARY KEY,
  wristband_id    INTEGER REFERENCES wristbands(id),
  person_id       INTEGER REFERENCES persons(id),
  assigned_at     TIMESTAMPTZ,
  unassigned_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS distributions (
  id                  INTEGER PRIMARY KEY,
  wristband_barcode   TEXT,
  resource_type       TEXT NOT NULL,
  quantity            REAL NOT NULL,
  distributed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_distributions_barcode ON distributions (wristband_barcode);

CREATE TABLE IF NOT EXISTS resources (
  id                  INTEGER PRIMARY KEY,
  resource_name       TEXT NOT NULL,
  category            TEXT,
  unit                TEXT DEFAULT 'portion',
  total_quantity      REAL NOT NULL DEFAULT 0,
  available_quantity  REAL NOT NULL DEFAULT 0,
  minimum_threshold   REAL DEFAULT 0,
  status              TEXT DEFAULT 'AVAILABLE',
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS resource_usage (
  id            INTEGER PRIMARY KEY,
  person_id     INTEGER REFERENCES persons(id),
  resource_id   INTEGER REFERENCES resources(id),
  meal          TEXT,
  quantity      REAL NOT NULL,
  date          TEXT NOT NULL,
  time          TEXT NOT NULL,
  recorded_by   TEXT,
  created_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_usage_person ON resource_usage (person_id, date);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY,
  actor         TEXT,
  action        TEXT NOT NULL,
  person_id     INTEGER,
  resource_id   INTEGER,
  wristband_id  INTEGER,
  quantity      REAL,
  details       TEXT,
  created_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);

-- ── Education domain — extended tables (synced from Raspberry Pi) ────────

CREATE TABLE IF NOT EXISTS pages_behavioral_signals (
  signal_id          TEXT PRIMARY KEY,
  session_id         TEXT NOT NULL,
  child_id           TEXT NOT NULL,
  accuracy_rate      REAL,
  false_tap_rate     REAL,
  avg_reaction_time  REAL,
  reaction_variance  REAL,
  idle_time_ratio    REAL,
  rapid_click_count  INTEGER DEFAULT 0,
  time_to_first_ms   REAL,
  completion_ratio   REAL
);

CREATE INDEX IF NOT EXISTS idx_signals_session ON pages_behavioral_signals (session_id);

CREATE TABLE IF NOT EXISTS pages_gate_decisions (
  decision_id     TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL,
  child_id        TEXT NOT NULL,
  attempt_number  INTEGER,
  composite_score REAL NOT NULL,
  decision        TEXT NOT NULL,
  decided_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gate_session ON pages_gate_decisions (session_id);

CREATE TABLE IF NOT EXISTS pages_content_responses (
  response_id      TEXT PRIMARY KEY,
  session_id       TEXT NOT NULL,
  child_id         TEXT NOT NULL,
  task_id          TEXT NOT NULL,
  selected_answer  TEXT NOT NULL,
  is_correct       SMALLINT,
  time_taken_ms    INTEGER NOT NULL,
  responded_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON pages_content_responses (session_id);

-- ── Sync log (idempotency tracking) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_log (
  sync_id       TEXT PRIMARY KEY,
  entity        TEXT NOT NULL,
  local_id      TEXT NOT NULL,
  camp_id       TEXT,
  operation     TEXT NOT NULL,
  status        TEXT DEFAULT 'received',
  received_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log (entity, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_received ON sync_log (received_at);
