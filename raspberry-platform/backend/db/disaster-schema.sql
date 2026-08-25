-- ============================================================
-- Disaster Database - SQLite Schema
-- File: schema.sql
-- Database: disaster.db
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. DISASTER EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS disaster_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    severity TEXT,
    location_lat REAL,
    location_lng REAL,
    started_at TEXT,
    ended_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 2. SENSOR READINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sensor_id TEXT NOT NULL,
    sensor_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    latitude REAL,
    longitude REAL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 3. ENVIRONMENTAL DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS environmental_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL,
    humidity REAL,
    pressure REAL,
    rainfall REAL,
    wind_speed REAL,
    wind_direction REAL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 4. WATER LEVEL READINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS water_level_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id TEXT,
    water_level REAL NOT NULL,
    unit TEXT,
    latitude REAL,
    longitude REAL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 5. GPS READINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS gps_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    source TEXT DEFAULT 'GPS_SENSOR',
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 5b. RAINFALL SENSOR READINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS rainfall_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    rain_analog INTEGER,
    rain_digital INTEGER,
    rain_status TEXT,
    wetness_level TEXT,
    wetness_value INTEGER,
    latitude REAL,
    longitude REAL,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 6. WEATHER DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS weather_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT,
    latitude REAL,
    longitude REAL,
    temperature REAL,
    humidity REAL,
    precipitation REAL,
    rainfall REAL,
    wind_speed REAL,
    wind_direction REAL,
    weather_code INTEGER,
    condition TEXT,
    forecast_data TEXT,
    forecast_time TEXT,
    source TEXT,
    fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 7. HYDROSPATIAL DATA
-- ============================================================

CREATE TABLE IF NOT EXISTS hydrospatial_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    latitude REAL,
    longitude REAL,
    elevation REAL,
    river_distance REAL,
    nearest_station_id TEXT,
    river_name TEXT,
    source TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 8. FLOOD PREDICTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS flood_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prediction_id TEXT UNIQUE,
    latitude REAL,
    longitude REAL,
    rainfall REAL,
    elevation REAL,
    river_distance REAL,
    flood_probability REAL,
    flood_category TEXT,
    forecast_hours INTEGER,
    model_version TEXT,
    predicted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 9. DISASTER ALERTS
-- ============================================================

CREATE TABLE IF NOT EXISTS disaster_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT,
    message TEXT,
    latitude REAL,
    longitude REAL,
    prediction_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 10. PREDICTION REQUESTS
-- ============================================================

CREATE TABLE IF NOT EXISTS prediction_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id TEXT UNIQUE,
    request_type TEXT,
    input_data TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    response_data TEXT,
    requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT,
    synced INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 11. DISASTER SYNC QUEUE
-- ============================================================

CREATE TABLE IF NOT EXISTS disaster_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL',
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    synced_at TEXT
);

-- ============================================================
-- 12. DISASTER SYNC LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS disaster_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT,
    record_id TEXT,
    mqtt_topic TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at
ON sensor_readings(recorded_at);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_sensor_id
ON sensor_readings(sensor_id);

CREATE INDEX IF NOT EXISTS idx_environmental_data_recorded_at
ON environmental_data(recorded_at);

CREATE INDEX IF NOT EXISTS idx_water_level_recorded_at
ON water_level_readings(recorded_at);

CREATE INDEX IF NOT EXISTS idx_water_level_station_id
ON water_level_readings(station_id);

CREATE INDEX IF NOT EXISTS idx_gps_readings_recorded_at
ON gps_readings(recorded_at);

CREATE INDEX IF NOT EXISTS idx_rainfall_readings_recorded_at
ON rainfall_readings(recorded_at);

CREATE INDEX IF NOT EXISTS idx_weather_data_forecast_time
ON weather_data(forecast_time);

CREATE INDEX IF NOT EXISTS idx_predictions_predicted_at
ON flood_predictions(predicted_at);

CREATE INDEX IF NOT EXISTS idx_predictions_category
ON flood_predictions(flood_category);

CREATE INDEX IF NOT EXISTS idx_alerts_status
ON disaster_alerts(status);

CREATE INDEX IF NOT EXISTS idx_alerts_severity
ON disaster_alerts(severity);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status
ON disaster_sync_queue(status);

CREATE INDEX IF NOT EXISTS idx_sync_queue_priority
ON disaster_sync_queue(priority);

CREATE INDEX IF NOT EXISTS idx_sync_log_synced_at
ON disaster_sync_log(synced_at);

-- ============================================================
-- OPTIONAL: MQTT SYNC PRIORITY
--
-- CRITICAL = 1
-- HIGH     = 2
-- NORMAL   = 3
-- LOW      = 4
-- ============================================================

-- ============================================================
-- END OF DISASTER DATABASE SCHEMA
-- ============================================================