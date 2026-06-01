#!/usr/bin/env node

/**
 * seed-test-children.js
 * Creates test child records for development and QR scanning tests
 * Run: node database/seed-test-children.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'pages.db');

console.log(`📁 Database path: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Test children to insert
const testChildren = [
  {
    child_id: 'TEST-CHILD-000260',
    res_id: 'RES-001',
    grade: 3,
    camp_id: 'CAMP-B',
    zone_id: 'ZONE-A1',
    language: 'si',
    total_sessions: 0,
    baseline_score: 60.0,
  },
  {
    child_id: 'TEST-CHILD-000261',
    res_id: 'RES-002',
    grade: 4,
    camp_id: 'CAMP-B',
    zone_id: 'ZONE-A1',
    language: 'ta',
    total_sessions: 0,
    baseline_score: 65.0,
  },
  {
    child_id: 'TEST-CHILD-000262',
    res_id: 'RES-003',
    grade: 3,
    camp_id: 'CAMP-B',
    zone_id: 'ZONE-B2',
    language: 'en',
    total_sessions: 0,
    baseline_score: 58.0,
  },
];

try {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO pages_children (
      child_id, res_id, grade, camp_id, zone_id, language,
      total_sessions, baseline_score, consecutive_low, sdq_band,
      alert_status, synced
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const child of testChildren) {
    insertStmt.run(
      child.child_id,
      child.res_id,
      child.grade,
      child.camp_id,
      child.zone_id,
      child.language,
      child.total_sessions,
      child.baseline_score,
      0, // consecutive_low
      'unknown', // sdq_band
      'none', // alert_status
      0  // synced
    );
    count++;
    console.log(`✅ Created test child: ${child.child_id} (Grade ${child.grade}, Language: ${child.language})`);
  }

  console.log(`\n✨ Successfully created ${count} test children!`);
  console.log(`\nYou can now scan these QR codes:`);
  testChildren.forEach(child => {
    console.log(`  - ${child.child_id} (${child.language})`);
  });

  db.close();
  process.exit(0);
} catch (err) {
  console.error('❌ Error creating test children:', err.message);
  db.close();
  process.exit(1);
}
