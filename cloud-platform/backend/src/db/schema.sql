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

ALTER TABLE children ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_children_device ON children (device_id);

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

ALTER TABLE persons ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_persons_device ON persons (device_id);

CREATE TABLE IF NOT EXISTS camp_checkins (
  id              INTEGER PRIMARY KEY,
  person_id       INTEGER REFERENCES persons(id),
  checkin_time    TIMESTAMPTZ,
  camp_day        INTEGER DEFAULT 1,
  is_new_arrival  SMALLINT DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_checkins_person ON camp_checkins (person_id);

ALTER TABLE camp_checkins ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_checkins_device ON camp_checkins (device_id);

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

ALTER TABLE distributions ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_distributions_device ON distributions (device_id);

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

-- ── Device registry (DEVICE_ID → CAMP_ID mapping) ───────────────────────

CREATE TABLE IF NOT EXISTS devices (
  device_id     TEXT PRIMARY KEY,
  camp_id       TEXT NOT NULL,
  name          TEXT,
  status        TEXT DEFAULT 'active',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_camp ON devices (camp_id);

-- ── Sync log (idempotency tracking) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS sync_log (
  sync_id       TEXT PRIMARY KEY,
  entity        TEXT NOT NULL,
  local_id      TEXT NOT NULL,
  camp_id       TEXT,
  device_id     TEXT,
  operation     TEXT NOT NULL,
  status        TEXT DEFAULT 'received',
  received_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log (entity, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_received ON sync_log (received_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_device ON sync_log (device_id);

-- ── Disaster domain (synced from Raspberry Pi via MQTT) ─────────────────

CREATE TABLE IF NOT EXISTS disaster_events (
  id              INTEGER PRIMARY KEY,
  event_type      TEXT NOT NULL,
  status          TEXT DEFAULT 'ACTIVE',
  severity        TEXT,
  location_lat    REAL,
  location_lng    REAL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_disaster_events_status ON disaster_events (status);

ALTER TABLE disaster_events ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_disaster_events_device ON disaster_events (device_id);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id              INTEGER PRIMARY KEY,
  sensor_id       TEXT NOT NULL,
  sensor_type     TEXT NOT NULL,
  value           REAL NOT NULL,
  unit            TEXT,
  latitude        REAL,
  longitude       REAL,
  recorded_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor ON sensor_readings (sensor_id);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded ON sensor_readings (recorded_at);

ALTER TABLE sensor_readings ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device ON sensor_readings (device_id);

CREATE TABLE IF NOT EXISTS environmental_data (
  id              INTEGER PRIMARY KEY,
  temperature     REAL,
  humidity        REAL,
  pressure        REAL,
  rainfall        REAL,
  wind_speed      REAL,
  wind_direction  REAL,
  recorded_at     TIMESTAMPTZ,
  source          TEXT
);

CREATE INDEX IF NOT EXISTS idx_environmental_data_recorded ON environmental_data (recorded_at);

ALTER TABLE environmental_data ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_environmental_data_device ON environmental_data (device_id);

CREATE TABLE IF NOT EXISTS water_level_readings (
  id              INTEGER PRIMARY KEY,
  station_id      TEXT,
  water_level     REAL NOT NULL,
  unit            TEXT,
  latitude        REAL,
  longitude       REAL,
  recorded_at     TIMESTAMPTZ,
  source          TEXT
);

CREATE INDEX IF NOT EXISTS idx_water_level_station ON water_level_readings (station_id);
CREATE INDEX IF NOT EXISTS idx_water_level_recorded ON water_level_readings (recorded_at);

ALTER TABLE water_level_readings ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_water_level_device ON water_level_readings (device_id);

CREATE TABLE IF NOT EXISTS gps_readings (
  id              INTEGER PRIMARY KEY,
  device_id       TEXT,
  latitude        REAL NOT NULL,
  longitude       REAL NOT NULL,
  altitude        REAL,
  accuracy        REAL,
  source          TEXT DEFAULT 'GPS_SENSOR',
  recorded_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gps_readings_recorded ON gps_readings (recorded_at);
CREATE INDEX IF NOT EXISTS idx_gps_readings_device ON gps_readings (device_id);

CREATE TABLE IF NOT EXISTS weather_data (
  id              INTEGER PRIMARY KEY,
  latitude        REAL,
  longitude       REAL,
  temperature     REAL,
  precipitation   REAL,
  rainfall        REAL,
  wind_speed      REAL,
  weather_code    INTEGER,
  forecast_time   TIMESTAMPTZ,
  source          TEXT,
  created_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_weather_forecast ON weather_data (forecast_time);

ALTER TABLE weather_data ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_weather_data_device ON weather_data (device_id);

CREATE TABLE IF NOT EXISTS hydrospatial_data (
  id                  INTEGER PRIMARY KEY,
  latitude            REAL,
  longitude           REAL,
  elevation           REAL,
  river_distance      REAL,
  nearest_station_id  TEXT,
  river_name          TEXT,
  source              TEXT,
  created_at          TIMESTAMPTZ
);

ALTER TABLE hydrospatial_data ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_hydrospatial_device ON hydrospatial_data (device_id);

CREATE TABLE IF NOT EXISTS flood_predictions (
  id                  INTEGER PRIMARY KEY,
  prediction_id       TEXT UNIQUE,
  latitude            REAL,
  longitude           REAL,
  rainfall            REAL,
  elevation           REAL,
  river_distance      REAL,
  flood_probability   REAL,
  flood_category      TEXT,
  forecast_hours      INTEGER,
  model_version       TEXT,
  predicted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flood_predictions_category ON flood_predictions (flood_category);
CREATE INDEX IF NOT EXISTS idx_flood_predictions_predicted ON flood_predictions (predicted_at);

ALTER TABLE flood_predictions ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_flood_predictions_device ON flood_predictions (device_id);

CREATE TABLE IF NOT EXISTS disaster_alerts (
  id              INTEGER PRIMARY KEY,
  alert_id        TEXT UNIQUE,
  event_id        TEXT UNIQUE,
  camp_id         TEXT,
  camp_name       TEXT,
  alert_type      TEXT NOT NULL,
  severity        TEXT NOT NULL,
  priority        TEXT NOT NULL DEFAULT 'NORMAL',
  title           TEXT,
  message         TEXT,
  latitude        REAL,
  longitude       REAL,
  prediction_id   TEXT,
  flood_probability REAL,
  flood_probability_percent REAL,
  risk_category   TEXT,
  forecast_hours  INTEGER,
  rainfall       REAL,
  camp_elevation REAL,
  river_distance_km REAL,
  water_level    REAL,
  station_id     TEXT,
  station_name   TEXT,
  gauge_elevation REAL,
  elevation_difference REAL,
  gauge_distance_km REAL,
  gauge_latitude REAL,
  gauge_longitude REAL,
  river_name     TEXT,
  camp_latitude  REAL,
  camp_longitude REAL,
  source         TEXT,
  prediction_timestamp TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ,
  schema_version TEXT DEFAULT '1.0',
  status          TEXT DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  mqtt_status     TEXT DEFAULT 'DELIVERED',
  cloud_sync_status TEXT DEFAULT 'SYNCED'
);

CREATE INDEX IF NOT EXISTS idx_disaster_alerts_status ON disaster_alerts (status);
CREATE INDEX IF NOT EXISTS idx_disaster_alerts_severity ON disaster_alerts (severity);

ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS alert_id TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS event_id TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS camp_id TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS camp_name TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL';
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS flood_probability REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS flood_probability_percent REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS risk_category TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS forecast_hours INTEGER;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS rainfall REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS camp_elevation REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS river_distance_km REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS water_level REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS station_id TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS station_name TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS gauge_elevation REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS elevation_difference REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS gauge_distance_km REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS gauge_latitude REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS gauge_longitude REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS river_name TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS camp_latitude REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS camp_longitude REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS prediction_timestamp TIMESTAMPTZ;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS schema_version TEXT DEFAULT '1.0';
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS mqtt_status TEXT DEFAULT 'DELIVERED';
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS cloud_sync_status TEXT DEFAULT 'SYNCED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_alerts_event_id ON disaster_alerts (event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_alerts_alert_id ON disaster_alerts (alert_id) WHERE alert_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disaster_alerts_camp ON disaster_alerts (camp_id, status);

ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_disaster_alerts_device ON disaster_alerts (device_id);

CREATE TABLE IF NOT EXISTS prediction_requests (
  id              INTEGER PRIMARY KEY,
  request_id      TEXT UNIQUE,
  request_type    TEXT,
  input_data      TEXT,
  status          TEXT DEFAULT 'PENDING',
  response_data   TEXT,
  requested_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

ALTER TABLE prediction_requests ADD COLUMN IF NOT EXISTS device_id TEXT;
CREATE INDEX IF NOT EXISTS idx_prediction_requests_device ON prediction_requests (device_id);

-- ── Resources domain: camp roster and daily population history ───────────────
-- The roster arrives over MQTT and used to live only in memory, which meant a
-- backend restart wiped the registration history the seven-day forecast fits
-- on. Persisting it lets that history accumulate.
CREATE TABLE IF NOT EXISTS camp_persons (
  id                  INTEGER PRIMARY KEY,
  full_name           TEXT,
  age                 INTEGER,
  gender              TEXT,
  family_unit_id      TEXT,
  is_pregnant         INTEGER DEFAULT 0,
  has_chronic_illness INTEGER DEFAULT 0,
  wristband_barcode   TEXT,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS camp_daily_snapshots (
  date              DATE PRIMARY KEY,
  total_persons     INTEGER NOT NULL,
  new_registrations INTEGER DEFAULT 0,
  checkins          INTEGER DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_camp_snapshots_date ON camp_daily_snapshots (date DESC);
