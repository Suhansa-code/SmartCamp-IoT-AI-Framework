#!/usr/bin/env node
/**
 * Seed DEMO camp registration history into the cloud database.
 *
 * The seven-day forecast fits a trend on daily registration history. A camp
 * that has just been switched on has none, so the planner correctly falls back
 * to holding the population flat and reports LOW confidence. That is honest
 * behaviour, but it makes the feature impossible to demonstrate before a week
 * of real operation.
 *
 * This script writes synthetic history so the forecast can be exercised end to
 * end. The data is fabricated and clearly marked as such — never present output
 * derived from it as a real result.
 *
 * Usage:
 *   node scripts/seed-camp-history.js            # 10 days, rising intake
 *   node scripts/seed-camp-history.js --days 14
 *   node scripts/seed-camp-history.js --clear    # remove all seeded rows
 */
import { db, initializeSchema } from '../src/config/database.js';

const SEED_PREFIX = 'SEED-';

function parseArgs(argv) {
  const args = { days: 10, clear: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--clear') args.clear = true;
    else if (argv[i] === '--days') args.days = Number.parseInt(argv[++i], 10) || 10;
  }
  return args;
}

function isoDaysAgo(offset) {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

function clear() {
  const persons = db.prepare(`DELETE FROM camp_persons WHERE full_name LIKE '${SEED_PREFIX}%'`).run();
  const snapshots = db.prepare('DELETE FROM camp_daily_snapshots').run();
  console.log(`Removed ${persons.changes} seeded person(s) and ${snapshots.changes} snapshot(s).`);
}

function seed(days) {
  // Rising intake with day-to-day noise, so Theil-Sen has something to fit that
  // is not a perfectly straight line.
  const arrivals = [];
  for (let i = 0; i < days; i++) {
    arrivals.push(Math.max(1, Math.round(6 + i * 1.4 + (i % 3 === 0 ? 4 : -1))));
  }

  const insertPerson = db.prepare(`
    INSERT INTO camp_persons
      (id, full_name, age, gender, family_unit_id, is_pregnant,
       has_chronic_illness, wristband_barcode, created_at, updated_at)
    VALUES (@id, @full_name, @age, @gender, @family_unit_id, @is_pregnant,
            @has_chronic_illness, @wristband_barcode, @created_at, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO NOTHING
  `);

  const insertSnapshot = db.prepare(`
    INSERT INTO camp_daily_snapshots (date, total_persons, new_registrations, checkins, updated_at)
    VALUES (@date, @total_persons, @new_registrations, @checkins, CURRENT_TIMESTAMP)
    ON CONFLICT(date) DO UPDATE SET
      total_persons = excluded.total_persons,
      new_registrations = excluded.new_registrations,
      checkins = excluded.checkins,
      updated_at = CURRENT_TIMESTAMP
  `);

  // Sri Lankan camp demography: roughly 28 % children, 12 % elderly.
  const ageFor = (n) => (n % 100 < 28 ? 4 + (n % 14) : n % 100 < 40 ? 60 + (n % 25) : 18 + (n % 42));

  // Ids well clear of anything the Pi issues, so real records are never touched.
  let nextId = 900_000;
  let running = 0;

  const run = db.transaction(() => {
    for (let i = 0; i < days; i++) {
      const date = isoDaysAgo(days - 1 - i);
      for (let k = 0; k < arrivals[i]; k++) {
        const id = nextId++;
        insertPerson.run({
          id,
          full_name: `${SEED_PREFIX}Resident ${id}`,
          age: ageFor(id),
          gender: id % 2 ? 'M' : 'F',
          family_unit_id: `${SEED_PREFIX}FAM${Math.floor(id / 4)}`,
          is_pregnant: id % 37 === 0 ? 1 : 0,
          has_chronic_illness: id % 29 === 0 ? 1 : 0,
          wristband_barcode: `${SEED_PREFIX}WB${id}`,
          created_at: `${date} 09:00:00`,
        });
      }
      running += arrivals[i];
      insertSnapshot.run({
        date,
        total_persons: running,
        new_registrations: arrivals[i],
        checkins: Math.round(running * 0.9),
        // eslint-disable-next-line no-unused-vars
      });
    }
  });

  run();

  console.log(`Seeded ${days} days of DEMO history, ${running} people total.`);
  console.log('Daily population:', db.prepare('SELECT date, total_persons FROM camp_daily_snapshots ORDER BY date').all()
    .map((r) => `${r.date.slice(5)}:${r.total_persons}`).join('  '));
  console.log('\nThis is fabricated data for demonstration. Run with --clear to remove it.');
}

const args = parseArgs(process.argv);
initializeSchema();
if (args.clear) clear();
else seed(args.days);
