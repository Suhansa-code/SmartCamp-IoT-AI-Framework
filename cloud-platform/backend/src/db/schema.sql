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
  task_score      REAL,
  passive_score   REAL,
  gate_decision   TEXT,
  z_score         REAL,
  if_score        REAL,
  anomaly_flagged SMALLINT DEFAULT 0,
  alert_triggered SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions (child_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions (created_at);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS task_score REAL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS passive_score REAL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS gate_decision TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS z_score REAL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS if_score REAL;

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
  max_wind INTEGER, avg_wind INTEGER, soil NUMERIC(5,3), pres INTEGER, cloud INTEGER,
  last_aggregation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS last_aggregation_at TIMESTAMPTZ;
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "CAMPS" ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

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
ALTER TABLE persons ADD COLUMN IF NOT EXISTS camp_id TEXT;
UPDATE persons SET camp_id = 'SCB-UNIT-01' WHERE camp_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_persons_camp ON persons (camp_id);

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

-- Resources are also created directly at the donation hub, while synced
-- records retain their source IDs through the existing upsert path.
CREATE SEQUENCE IF NOT EXISTS resources_id_seq;
SELECT setval(
  'resources_id_seq',
  COALESCE((SELECT MAX(id) FROM resources), 1),
  (SELECT COUNT(*) > 0 FROM resources)
);
ALTER TABLE resources ALTER COLUMN id SET DEFAULT nextval('resources_id_seq');

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
  priority      TEXT NOT NULL DEFAULT 'MEDIUM',
  received_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'MEDIUM';
CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log (entity, local_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_received ON sync_log (received_at);
CREATE INDEX IF NOT EXISTS idx_sync_log_device ON sync_log (device_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_priority_received ON sync_log (priority, received_at DESC);

-- Latest connectivity observation reported by each Raspberry Pi. Network
-- samples are telemetry, so the dashboard needs the latest value per device,
-- while sync_log retains the delivery trail.
CREATE TABLE IF NOT EXISTS network_status (
  device_id         TEXT PRIMARY KEY,
  camp_id           TEXT,
  state             TEXT NOT NULL,
  raw_state         TEXT,
  metrics           JSONB,
  qos_policy        JSONB,
  reachability      JSONB,
  buffered_messages INTEGER NOT NULL DEFAULT 0,
  observed_at       TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_network_status_camp ON network_status (camp_id);
CREATE INDEX IF NOT EXISTS idx_network_status_observed ON network_status (observed_at DESC);

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

ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS temperature REAL;
ALTER TABLE disaster_alerts ADD COLUMN IF NOT EXISTS humidity REAL;

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

-- ── Resource inventory (Neon/PostgreSQL) ──────────────────────────────────
-- `resources` above is the Raspberry Pi sync mirror.  It cannot safely mix
-- water recorded in litres with water recorded in millilitres, so operational
-- stock is kept here.  Every amount is also stored in the forecasting base
-- unit: food in kg and water in litres.  `recorded_unit` keeps the unit a
-- staff member used at entry, so the UI never silently changes their form.
CREATE TABLE IF NOT EXISTS resource_inventory_items (
  id                        BIGSERIAL PRIMARY KEY,
  resource_name             TEXT NOT NULL,
  category                  TEXT NOT NULL CHECK (category IN ('food', 'water')),
  recorded_unit             TEXT NOT NULL CHECK (recorded_unit IN ('kg', 'L', 'mL')),
  base_unit                 TEXT NOT NULL CHECK (base_unit IN ('kg', 'L')),
  available_base_quantity   NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (available_base_quantity >= 0),
  minimum_base_quantity     NUMERIC(14, 3) NOT NULL DEFAULT 0 CHECK (minimum_base_quantity >= 0),
  status                    TEXT NOT NULL DEFAULT 'AVAILABLE'
                            CHECK (status IN ('AVAILABLE', 'LOW', 'CRITICAL', 'UNAVAILABLE')),
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (resource_name, category)
);

ALTER TABLE resource_inventory_items ADD COLUMN IF NOT EXISTS camp_id TEXT;
UPDATE resource_inventory_items SET camp_id = 'SCB-UNIT-01' WHERE camp_id IS NULL;
ALTER TABLE resource_inventory_items ALTER COLUMN camp_id SET NOT NULL;
ALTER TABLE resource_inventory_items ALTER COLUMN camp_id SET DEFAULT 'SCB-UNIT-01';
ALTER TABLE resource_inventory_items DROP CONSTRAINT IF EXISTS resource_inventory_items_resource_name_category_key;
ALTER TABLE resource_inventory_items DROP CONSTRAINT IF EXISTS resource_inventory_items_camp_resource_category_key;
ALTER TABLE resource_inventory_items ADD CONSTRAINT resource_inventory_items_camp_resource_category_key
  UNIQUE (camp_id, resource_name, category);

CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON resource_inventory_items (category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON resource_inventory_items (status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_camp ON resource_inventory_items (camp_id);

-- Immutable stock ledger.  Adjustments are auditable and provide the resource
-- consumption series shown by the existing dashboard format.
CREATE TABLE IF NOT EXISTS resource_inventory_movements (
  id                        BIGSERIAL PRIMARY KEY,
  inventory_item_id         BIGINT NOT NULL REFERENCES resource_inventory_items(id) ON DELETE CASCADE,
  quantity_base_change      NUMERIC(14, 3) NOT NULL,
  recorded_quantity_change  NUMERIC(14, 3) NOT NULL,
  recorded_unit             TEXT NOT NULL CHECK (recorded_unit IN ('kg', 'L', 'mL')),
  movement_type             TEXT NOT NULL CHECK (movement_type IN ('opening_balance', 'received', 'issued', 'adjustment')),
  reason                    TEXT,
  recorded_by               TEXT,
  occurred_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_time
  ON resource_inventory_movements (inventory_item_id, occurred_at DESC);

-- An optional reproducible snapshot of the features and forecast used for a
-- resource decision.  The live endpoint always recalculates from current
-- inventory and household data; snapshots make past decisions traceable.
CREATE TABLE IF NOT EXISTS resource_inventory_prediction_snapshots (
  id                        BIGSERIAL PRIMARY KEY,
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  horizon_days              INTEGER NOT NULL,
  household_features        JSONB NOT NULL,
  inventory_features        JSONB NOT NULL,
  prediction                JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_prediction_snapshots_generated
  ON resource_inventory_prediction_snapshots (generated_at DESC);

-- Public donations are pledges until money clears or staff physically receive
-- the offered goods. They never mutate operational inventory directly.
CREATE TABLE IF NOT EXISTS donations (
  id                  UUID PRIMARY KEY,
  donor_google_id     TEXT NOT NULL,
  donor_email         TEXT NOT NULL,
  donor_name          TEXT NOT NULL,
  donation_type       TEXT NOT NULL CHECK (donation_type IN ('MONEY', 'IN_KIND')),
  status              TEXT NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'PLEDGED', 'RECEIVED', 'CANCELLED')),
  currency            TEXT,
  amount_minor        BIGINT CHECK (amount_minor IS NULL OR amount_minor > 0),
  resource_name       TEXT,
  resource_category   TEXT,
  quantity            NUMERIC(14, 3) CHECK (quantity IS NULL OR quantity > 0),
  unit                TEXT,
  country             TEXT,
  message             TEXT,
  provider_reference  TEXT UNIQUE,
  payment_reference   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations (donor_google_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations (status, created_at DESC);

-- ── Relief Portal (donations → supermarket purchases → delivery → receipt) ──
-- Transactional store for the public relief marketplace. etcd is NOT used:
-- this repo has no etcd deployment and none of these rows are distributed
-- configuration; they are money/inventory-bearing transactions that belong in
-- PostgreSQL alongside the existing donations and inventory tables.

-- Staff roles for the relief portal: ADMIN, PARTNER (supermarket),
-- COLLECTION_CENTRE, CAMP_MANAGER. Donors keep using the existing Google
-- donor session (donations auth) and are not stored here.
CREATE TABLE IF NOT EXISTS relief_staff_users (
  id            UUID PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('ADMIN', 'PARTNER', 'COLLECTION_CENTRE', 'CAMP_MANAGER')),
  org_code      TEXT,                       -- partner key, centre code, or camp id
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partner supermarket catalogue. Rows are written by adapter sync or seeded;
-- availability_source records how fresh/trustworthy the data is so the UI can
-- label unverified stock honestly instead of fabricating availability.
CREATE TABLE IF NOT EXISTS relief_products (
  id                  BIGSERIAL PRIMARY KEY,
  partner_code        TEXT NOT NULL CHECK (partner_code IN ('KEELLS', 'CARGILLS', 'ARPICO', 'SPAR')),
  sku                 TEXT NOT NULL,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL CHECK (category IN ('food', 'water', 'medicine', 'hygiene', 'shelter', 'other')),
  unit                TEXT NOT NULL,
  unit_price_lkr      NUMERIC(12, 2) NOT NULL CHECK (unit_price_lkr >= 0),
  currency            TEXT NOT NULL DEFAULT 'LKR',
  stock_quantity      INTEGER,              -- NULL = unknown; never invent a number
  stock_status        TEXT NOT NULL DEFAULT 'UNKNOWN'
                      CHECK (stock_status IN ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNKNOWN')),
  availability_source TEXT NOT NULL DEFAULT 'MANUAL'
                      CHECK (availability_source IN ('LIVE_API', 'SANDBOX', 'MANUAL')),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at      TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (partner_code, sku)
);

CREATE INDEX IF NOT EXISTS idx_relief_products_partner ON relief_products (partner_code, is_active);

-- Donation / purchase orders. status: CREATED → AWAITING_PAYMENT → PAID →
-- CONFIRMED_WITH_PARTNER → OUT_FOR_DELIVERY → DELIVERED → RECEIVED, with
-- CANCELLED/EXPIRED side paths. A row can never reach PAID without a verified
-- relief_payment (enforced in payment.service.js + tests).
CREATE TABLE IF NOT EXISTS relief_orders (
  id                UUID PRIMARY KEY,
  reference         TEXT NOT NULL UNIQUE,          -- public tracking code e.g. SRO-2026-000123
  donor_google_id   TEXT NOT NULL,
  donor_email       TEXT NOT NULL,
  donor_name        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('MONEY_DONATION', 'RESOURCE_PURCHASE')),
  partner_code      TEXT CHECK (partner_code IS NULL OR partner_code IN ('KEELLS', 'CARGILLS', 'ARPICO', 'SPAR')),
  status            TEXT NOT NULL DEFAULT 'CREATED'
                    CHECK (status IN ('CREATED', 'AWAITING_PAYMENT', 'PAID', 'CONFIRMED_WITH_PARTNER',
                                      'OUT_FOR_DELIVERY', 'DELIVERED', 'RECEIVED', 'CANCELLED', 'EXPIRED')),
  subtotal_lkr      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  delivery_lkr      NUMERIC(14, 2) NOT NULL DEFAULT 0,
  total_lkr         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (total_lkr >= 0),
  destination_type  TEXT CHECK (destination_type IN ('COLLECTION_CENTRE', 'CAMP')),
  destination_code  TEXT,
  destination_name  TEXT,
  message           TEXT,
  idempotency_key   TEXT UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_orders_donor ON relief_orders (donor_google_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relief_orders_status ON relief_orders (status, created_at DESC);

CREATE TABLE IF NOT EXISTS relief_order_items (
  id             BIGSERIAL PRIMARY KEY,
  order_id       UUID NOT NULL REFERENCES relief_orders(id) ON DELETE CASCADE,
  partner_code   TEXT NOT NULL,
  sku            TEXT NOT NULL,
  name           TEXT NOT NULL,
  category       TEXT NOT NULL,
  unit           TEXT NOT NULL,
  unit_price_lkr NUMERIC(12, 2) NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  line_total_lkr NUMERIC(14, 2) NOT NULL,
  CHECK (line_total_lkr = unit_price_lkr * quantity)
);

CREATE INDEX IF NOT EXISTS idx_relief_order_items_order ON relief_order_items (order_id);

-- Payment attempts. provider_reference is the gateway's checkout/txn id and is
-- UNIQUE so a retried webhook can never create a second row.
CREATE TABLE IF NOT EXISTS relief_payments (
  id                 UUID PRIMARY KEY,
  order_id           UUID NOT NULL REFERENCES relief_orders(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('PAYHERE', 'STRIPE', 'BANK_TRANSFER', 'LANKAQR', 'SANDBOX')),
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'AWAITING_CONFIRMATION', 'VERIFIED', 'FAILED', 'EXPIRED', 'CANCELLED')),
  amount_lkr         NUMERIC(14, 2) NOT NULL CHECK (amount_lkr >= 0),
  currency           TEXT NOT NULL DEFAULT 'LKR',
  provider_reference TEXT UNIQUE,
  payer_reference    TEXT,                  -- bank slip / LR no. for manual methods
  verified_by        TEXT,                  -- staff email for manual confirmation
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_payments_order ON relief_payments (order_id);

-- Webhook / callback event log. event_id is UNIQUE: duplicate deliveries and
-- retries are recorded once and acknowledged without re-processing.
CREATE TABLE IF NOT EXISTS relief_payment_events (
  id            BIGSERIAL PRIMARY KEY,
  event_id      TEXT NOT NULL UNIQUE,
  payment_id    UUID REFERENCES relief_payments(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  event_type    TEXT,
  payload       JSONB,
  signature_ok  BOOLEAN NOT NULL DEFAULT FALSE,
  process_result TEXT,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_payment_events_payment ON relief_payment_events (payment_id, received_at DESC);

-- Delivery bookings (Uber / PickMe / manual fallback).
CREATE TABLE IF NOT EXISTS relief_deliveries (
  id                 UUID PRIMARY KEY,
  order_id           UUID NOT NULL REFERENCES relief_orders(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('UBER', 'PICKME', 'MANUAL')),
  status             TEXT NOT NULL DEFAULT 'REQUESTED'
                     CHECK (status IN ('REQUESTED', 'QUOTED', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'FAILED')),
  quote_estimate_lkr NUMERIC(14, 2),
  provider_reference TEXT UNIQUE,           -- Uber trip id / PickMe job id / manual waybill no.
  tracking_url       TEXT,
  manual_reference   TEXT,                  -- courier name + waybill typed by staff
  pickup_note        TEXT,
  booked_by          TEXT,                  -- staff email
  booked_at          TIMESTAMPTZ,
  delivered_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_deliveries_order ON relief_deliveries (order_id);

CREATE TABLE IF NOT EXISTS relief_delivery_events (
  id            BIGSERIAL PRIMARY KEY,
  delivery_id   UUID NOT NULL REFERENCES relief_deliveries(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  provider_reference TEXT,
  note          TEXT,
  actor         TEXT,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_delivery_events_delivery ON relief_delivery_events (delivery_id, occurred_at DESC);

-- Confirms a delivery physically arrived. Only this confirmation (by
-- COLLECTION_CENTRE or CAMP_MANAGER or ADMIN) may post inventory movements.
CREATE TABLE IF NOT EXISTS relief_receipts (
  id            UUID PRIMARY KEY,
  delivery_id   UUID NOT NULL UNIQUE REFERENCES relief_deliveries(id) ON DELETE CASCADE,
  order_id      UUID NOT NULL REFERENCES relief_orders(id) ON DELETE CASCADE,
  received_by   TEXT NOT NULL,             -- staff email
  received_role TEXT NOT NULL,
  condition     TEXT NOT NULL DEFAULT 'INTACT' CHECK (condition IN ('INTACT', 'PARTIAL', 'DAMAGED')),
  item_count    INTEGER,
  notes         TEXT,
  inventory_applied BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Camp resource requests raised by camp managers (shortages → admin → order).
CREATE TABLE IF NOT EXISTS relief_camp_requests (
  id            UUID PRIMARY KEY,
  camp_id       TEXT NOT NULL,
  requested_by  TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  category      TEXT NOT NULL,
  quantity      NUMERIC(14, 3) NOT NULL CHECK (quantity > 0),
  unit          TEXT NOT NULL,
  priority      TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  status        TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN', 'APPROVED', 'ORDERED', 'FULFILLED', 'CANCELLED')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_camp_requests_status ON relief_camp_requests (status, priority);

-- Campaign progress shown on the public transparency dashboard. Figures are
-- derived from verified payments and receipts, never entered by hand.
CREATE TABLE IF NOT EXISTS relief_campaigns (
  id            UUID PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  goal_amount_lkr NUMERIC(14, 2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED')),
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Append-only audit trail for relief actions (payments verified, receipts
-- posted, status changes). Distinct from the Raspberry audit_logs table.
CREATE TABLE IF NOT EXISTS relief_audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor       TEXT NOT NULL,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relief_audit_action ON relief_audit_logs (action, created_at DESC);
