PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS pages_admins (
  admin_id    TEXT PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
);

CREATE TABLE IF NOT EXISTS pages_children (
  child_id          TEXT PRIMARY KEY,
  res_id            TEXT NOT NULL,
  grade             INTEGER NOT NULL CHECK (grade IN (3, 4)),
  camp_id           TEXT NOT NULL,
  zone_id           TEXT,
  language          TEXT NOT NULL DEFAULT 'si' CHECK (language IN ('si', 'ta', 'en')),
  enrolled_at       TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
  total_sessions    INTEGER NOT NULL DEFAULT 0,
  baseline_score    REAL NOT NULL DEFAULT 60.0,
  consecutive_low   INTEGER NOT NULL DEFAULT 0,
  sdq_band          TEXT NOT NULL DEFAULT 'unknown',
  alert_status      TEXT NOT NULL DEFAULT 'none' CHECK (alert_status IN ('none', 'active', 'resolved')),
  synced            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_children_camp   ON pages_children(camp_id);
CREATE INDEX IF NOT EXISTS idx_children_synced ON pages_children(synced);

CREATE TABLE IF NOT EXISTS pages_sessions (
  session_id            TEXT PRIMARY KEY,
  child_id              TEXT NOT NULL REFERENCES pages_children(child_id),
  content_session_id    TEXT,
  session_date          TEXT NOT NULL,
  session_time          TEXT NOT NULL,
  condition_label       TEXT NOT NULL DEFAULT 'A' CHECK (condition_label IN ('A', 'B', 'C')),
  composite_score       REAL,
  task_score            REAL,
  passive_score         REAL,
  baseline_score_used   REAL NOT NULL,
  gate_decision         TEXT CHECK (gate_decision IN ('PASS', 'FAIL_FIRST', 'FAIL_CONFIRMED', 'PASS_RECOVERED')),
  second_gate_score     REAL,
  cognitive_score       REAL,
  session_complete      INTEGER NOT NULL DEFAULT 0,
  anomaly_flagged       INTEGER NOT NULL DEFAULT 0,
  z_score               REAL,
  if_score              REAL,
  alert_triggered       INTEGER NOT NULL DEFAULT 0,
  synced                INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_child  ON pages_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date   ON pages_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_synced ON pages_sessions(synced);

CREATE TABLE IF NOT EXISTS pages_behavioral_signals (
  signal_id           TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES pages_sessions(session_id),
  child_id            TEXT NOT NULL REFERENCES pages_children(child_id),
  accuracy_rate       REAL NOT NULL CHECK (accuracy_rate BETWEEN 0.0 AND 1.0),
  false_tap_rate      REAL NOT NULL CHECK (false_tap_rate BETWEEN 0.0 AND 1.0),
  avg_reaction_time   REAL NOT NULL,
  reaction_variance   REAL NOT NULL,
  idle_time_ratio     REAL NOT NULL CHECK (idle_time_ratio BETWEEN 0.0 AND 1.0),
  rapid_click_count   INTEGER NOT NULL DEFAULT 0,
  time_to_first_ms    REAL NOT NULL,
  completion_ratio    REAL NOT NULL CHECK (completion_ratio BETWEEN 0.0 AND 1.0),
  synced              INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_signals_session ON pages_behavioral_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_signals_synced  ON pages_behavioral_signals(synced);

CREATE TABLE IF NOT EXISTS pages_gate_decisions (
  decision_id       TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES pages_sessions(session_id),
  child_id          TEXT NOT NULL REFERENCES pages_children(child_id),
  attempt_number    INTEGER NOT NULL CHECK (attempt_number IN (1, 2)),
  composite_score   REAL NOT NULL,
  decision          TEXT NOT NULL,
  decided_at        TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
  synced            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gate_session  ON pages_gate_decisions(session_id);
CREATE INDEX IF NOT EXISTS idx_gate_child    ON pages_gate_decisions(child_id);
CREATE INDEX IF NOT EXISTS idx_gate_synced   ON pages_gate_decisions(synced);

CREATE TABLE IF NOT EXISTS pages_alerts (
  alert_id          TEXT PRIMARY KEY,
  child_id          TEXT NOT NULL REFERENCES pages_children(child_id),
  camp_id           TEXT NOT NULL,
  res_id            TEXT NOT NULL,
  alert_type        TEXT NOT NULL CHECK (alert_type IN ('3_consecutive_flagged', '3_of_5_flagged')),
  trigger_detail    TEXT NOT NULL,
  triggered_at      TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  resolved_at       TEXT,
  resolved_notes    TEXT,
  synced            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_alerts_child  ON pages_alerts(child_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON pages_alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_synced ON pages_alerts(synced);

CREATE TABLE IF NOT EXISTS content_sessions (
  content_session_id    TEXT PRIMARY KEY,
  session_label         TEXT NOT NULL,
  grade_level           INTEGER NOT NULL CHECK (grade_level IN (3, 4)),
  zeo_approved          INTEGER NOT NULL DEFAULT 0,
  approved_date         TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
);

CREATE TABLE IF NOT EXISTS content_tasks (
  task_id               TEXT PRIMARY KEY,
  content_session_id    TEXT NOT NULL REFERENCES content_sessions(content_session_id),
  task_order            INTEGER NOT NULL CHECK (task_order BETWEEN 1 AND 10),
  subject               TEXT NOT NULL,
  task_type             TEXT NOT NULL DEFAULT 'mcq',
  question_text         TEXT NOT NULL,
  question_image        TEXT,
  option_a              TEXT NOT NULL,
  option_b              TEXT NOT NULL,
  option_c              TEXT NOT NULL,
  correct_answer        TEXT NOT NULL CHECK (correct_answer IN ('a', 'b', 'c')),
  grade_level           INTEGER NOT NULL CHECK (grade_level IN (3, 4))
);

CREATE INDEX IF NOT EXISTS idx_tasks_session ON content_tasks(content_session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_grade   ON content_tasks(grade_level);

CREATE TABLE IF NOT EXISTS pages_content_responses (
  response_id       TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES pages_sessions(session_id),
  child_id          TEXT NOT NULL REFERENCES pages_children(child_id),
  task_id           TEXT NOT NULL,
  selected_answer   TEXT NOT NULL,
  is_correct        INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  time_taken_ms     INTEGER NOT NULL,
  responded_at      TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
  synced            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON pages_content_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_synced  ON pages_content_responses(synced);

CREATE TABLE IF NOT EXISTS pages_sync_queue (
  queue_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name    TEXT NOT NULL,
  record_id     TEXT NOT NULL,
  operation     TEXT NOT NULL DEFAULT 'INSERT',
  sync_status   TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  retry_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes')),
  synced_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON pages_sync_queue(sync_status);
CREATE INDEX IF NOT EXISTS idx_queue_table  ON pages_sync_queue(table_name);

CREATE TABLE IF NOT EXISTS pages_sync_log (
  log_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  records_pushed    INTEGER NOT NULL DEFAULT 0,
  model_files_pulled INTEGER NOT NULL DEFAULT 0,
  sync_status       TEXT NOT NULL,
  error_message     TEXT,
  synced_at         TEXT NOT NULL DEFAULT (datetime('now', '+5 hours', '+30 minutes'))
);

INSERT OR IGNORE INTO pages_admins (admin_id, username, password)
VALUES ('admin-default-001', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');

INSERT OR IGNORE INTO content_sessions (content_session_id, session_label, grade_level, zeo_approved, approved_date)
VALUES
  ('SESSION-A', 'A', 3, 1, '2024-01-01'),
  ('SESSION-B', 'B', 3, 1, '2024-01-01'),
  ('SESSION-C', 'C', 3, 1, '2024-01-01'),
  ('SESSION-D', 'D', 4, 1, '2024-01-01'),
  ('SESSION-E', 'E', 4, 1, '2024-01-01'),
  ('SESSION-F', 'F', 3, 1, '2024-01-01'),
  ('SESSION-G', 'G', 4, 1, '2024-01-01'),
  ('SESSION-H', 'H', 4, 1, '2024-01-01'),
  ('SESSION-I', 'I', 4, 1, '2024-01-01'),
  ('SESSION-J', 'J', 4, 1, '2024-01-01');
