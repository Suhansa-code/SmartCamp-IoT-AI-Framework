#!/usr/bin/env node
/**
 * Reconcile per-person MQTT accounts with the broker.
 *
 * Registration used to store credentials whether or not EMQX accepted them, so
 * people can hold a client id and password that exist only in SQLite. Every
 * publish as those clients fails, buffers, and is re-sent by the shared client
 * — delivery survives, but the per-person identity does not.
 *
 *   node scripts/provision-mqtt-users.js --dry-run   # report only
 *   node scripts/provision-mqtt-users.js             # create what is missing
 *   node scripts/provision-mqtt-users.js --rotate    # also reset passwords
 *
 * Needs EMQX_API_KEY / EMQX_API_SECRET set, otherwise there is nothing it can do.
 */
import '../config/load-env.js';
import { campDb } from '../config/database.js';
import * as emqx from '../services/network/emqx-manager.js';

const dryRun = process.argv.includes('--dry-run');
const rotate = process.argv.includes('--rotate');

const genPassword = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

async function main() {
  if (!process.env.EMQX_API_KEY || process.env.EMQX_API_KEY.startsWith('your_')) {
    console.error('EMQX_API_KEY is not set — no account can be created. Set it in .env first.');
    process.exit(1);
  }

  const existing = await emqx.listMqttUsers();
  if (!existing.ok) {
    console.error(`Could not list broker users (HTTP ${existing.status}).`);
    process.exit(1);
  }

  const onBroker = new Set(
    (existing.body?.data ?? existing.body ?? []).map((u) => u.user_id).filter(Boolean)
  );
  console.log(`Broker currently holds ${onBroker.size} account(s).`);

  const people = campDb.prepare(
    `SELECT id, mqtt_client_id FROM persons
      WHERE mqtt_client_id IS NOT NULL AND mqtt_client_id != ''`
  ).all();

  const missing = people.filter((p) => !onBroker.has(p.mqtt_client_id));
  console.log(`${people.length} person(s) hold credentials; ${missing.length} missing on the broker.`);

  if (missing.length === 0 && !rotate) return;

  const targets = rotate ? people : missing;
  if (dryRun) {
    for (const p of targets) console.log(`  would provision ${p.mqtt_client_id} (person ${p.id})`);
    console.log('\nDry run — nothing changed.');
    return;
  }

  let ok = 0;
  for (const p of targets) {
    const password = genPassword();
    const res = await emqx.createMqttUser(p.mqtt_client_id, password);
    if (res.ok || res.status === 409) {
      campDb.prepare('UPDATE persons SET mqtt_password = ? WHERE id = ?').run(password, p.id);
      ok++;
    } else {
      console.warn(`  failed ${p.mqtt_client_id} (HTTP ${res.status})`);
    }
  }
  console.log(`Provisioned ${ok}/${targets.length}.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
