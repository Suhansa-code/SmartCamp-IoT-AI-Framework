// SQLite database wrapper for Smart Camp Box
// Uses better-sqlite3 — fast, synchronous, perfect for Pi 5

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'smartcamp.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS persons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fingerprint_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT,
      family_unit_id TEXT,
      family_size INTEGER DEFAULT 1,
      is_pregnant INTEGER DEFAULT 0,
      has_chronic_illness INTEGER DEFAULT 0,
      medical_notes TEXT,
      pre_registered INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS camp_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER REFERENCES persons(id),
      checkin_time TEXT DEFAULT (datetime('now')),
      camp_day INTEGER DEFAULT 1,
      is_new_arrival INTEGER DEFAULT 1,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS wristbands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER REFERENCES persons(id),
      barcode TEXT UNIQUE NOT NULL,
      issued_at TEXT DEFAULT (datetime('now')),
      is_active INTEGER DEFAULT 1,
      synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wristband_barcode TEXT REFERENCES wristbands(barcode),
      resource_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      distributed_at TEXT DEFAULT (datetime('now')),
      synced INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_dist_today
      ON distributions(wristband_barcode, distributed_at);

    CREATE TABLE IF NOT EXISTS mqtt_buffer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      payload TEXT NOT NULL,
      priority TEXT NOT NULL,
      qos INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      flushed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS prediction_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inputs TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      sent_at TEXT,
      result TEXT
    );
  `);

  // Add person_type column for UNHCR category tracking
  try { db.exec("ALTER TABLE persons ADD COLUMN person_type TEXT DEFAULT 'refugee'") } catch (_) {}
  db.exec(`CREATE INDEX IF NOT EXISTS idx_persons_type ON persons(person_type)`)

  // Add MQTT client columns if this is an existing database (safe to run on every startup).
  // SQLite ALTER TABLE does NOT support UNIQUE — uniqueness is enforced via a separate index.
  try { db.exec('ALTER TABLE persons ADD COLUMN mqtt_client_id TEXT') } catch (_) {}
  try { db.exec('ALTER TABLE persons ADD COLUMN mqtt_password  TEXT') } catch (_) {}
  // Partial unique index: allows many NULL rows, but no two rows can share the same client ID
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_persons_mqtt_client_id
      ON persons(mqtt_client_id)
     WHERE mqtt_client_id IS NOT NULL
  `);

  // Seed a few sample pre-registered persons (for demo)
  const count = db.prepare('SELECT COUNT(*) as c FROM persons').get().c;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO persons
      (fingerprint_id, full_name, age, gender, family_unit_id,
       family_size, is_pregnant, has_chronic_illness, medical_notes,
       pre_registered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const samples = [
      ['FP_0001', 'Kasun Perera', 34, 'M', 'FAM_001', 4, 0, 0, '', ],
      ['FP_0002', 'Nimali Silva', 67, 'F', 'FAM_002', 2, 0, 1, 'Diabetes type 2'],
      ['FP_0003', 'Ravi Jayasuriya', 8, 'M', 'FAM_001', 4, 0, 0, ''],
      ['FP_0004', 'Tharushi Fernando', 28, 'F', 'FAM_003', 3, 1, 0, 'Pregnant 6 months'],
    ];
    for (const s of samples) insert.run(...s);
    console.log('Seeded 4 sample persons.');
  }

  console.log('Database initialised at', DB_PATH);
}

module.exports = { db, initialize };
