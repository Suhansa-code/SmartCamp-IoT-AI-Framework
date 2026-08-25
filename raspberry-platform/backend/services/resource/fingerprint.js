import { campDb as db } from '../../config/database.js';
import C from '../../config/constants.js';
import logger from '../../utils/logger.js';
import * as saamp from '../network/saamp-mqtt.js';
import { FingerprintSerial } from './fingerprint-serial.js';
import { broadcast } from './fingerprint-events.js';

/** Live hardware bridge — null until initFingerprintHardware() runs, or when disabled. */
let hardware = null;

/** Enrollment in flight: { slot, person_id, started_at }. Only one at a time — one sensor. */
let pendingEnrollment = null;

const ENROLL_TIMEOUT_MS = 60000;
let enrollTimer = null;
let enrollGeneration = 0;

// ── Person lookup ───────────────────────────────────────────
const PERSON_BY_SLOT_SQL = `
  SELECT p.*, w.barcode AS wristband_barcode
  FROM persons p
  LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
  WHERE p.is_active = 1 AND p.fingerprint_slot = ?
`;

export function resolveSlot(slot) {
  const n = parseInt(slot, 10);
  if (!Number.isInteger(n)) return { matched: false, slot: null };

  const person = db.prepare(PERSON_BY_SLOT_SQL).get(n);
  if (person) return { matched: true, slot: n, person };
  return { matched: false, slot: n, message: 'Fingerprint recognised but not linked to any person' };
}

/** Smallest unused sensor slot, 1..FINGERPRINT_MAX_SLOTS. */
export function nextFreeSlot() {
  const taken = new Set(
    db.prepare('SELECT fingerprint_slot FROM persons WHERE fingerprint_slot IS NOT NULL')
      .all().map(r => r.fingerprint_slot)
  );
  for (let slot = 1; slot <= C.FINGERPRINT_MAX_SLOTS; slot++) {
    if (!taken.has(slot)) return slot;
  }
  throw Object.assign(
    new Error(`Sensor is full — all ${C.FINGERPRINT_MAX_SLOTS} template slots are in use`),
    { status: 409 }
  );
} 

// ── Hardware lifecycle ──────────────────────────────────────
export async function initFingerprintHardware() {
  if (!C.FINGERPRINT_ENABLED) {
    logger.info('[FP] Hardware disabled — scans fall back to simulation');
    return null;
  }
  if (!C.FINGERPRINT_SERIAL_PORT) {
    logger.warn('[FP] FINGERPRINT_ENABLED is set but FINGERPRINT_SERIAL_PORT is empty — hardware not started');
    return null;
  }

  hardware = new FingerprintSerial({
    path: C.FINGERPRINT_SERIAL_PORT,
    baudRate: C.FINGERPRINT_BAUD_RATE,
  });

  hardware.on('status', (status) => broadcast('status', status));
  hardware.on('device-event', (packet) => { handleDeviceEvent(packet).catch(err =>
    logger.error(`[FP] Event handler failed: ${err.message}`)); });

  await hardware.start();
  return hardware;
}

export function stopFingerprintHardware() {
  if (hardware) hardware.stop();
  hardware = null;
}

export function getHardware() {
  return hardware;
}

export function getStatus() {
  return {
    enabled: Boolean(C.FINGERPRINT_ENABLED),
    simulation: !hardware || !hardware.connected,
    max_slots: C.FINGERPRINT_MAX_SLOTS,
    enrolling: pendingEnrollment ? { ...pendingEnrollment } : null,
    linked_count: db.prepare(
      'SELECT COUNT(*) AS c FROM persons WHERE fingerprint_slot IS NOT NULL AND is_active = 1'
    ).get().c,
    device: hardware ? hardware.status : { connected: false, port: C.FINGERPRINT_SERIAL_PORT || null },
  };
}

// ── Firmware vocabulary ─────────────────────────────────────
// Sketches in the wild name these events inconsistently. Rather than demand one
// spelling, map every plausible synonym onto the four outcomes that matter.
const MATCH_EVENTS     = new Set(['AUTHENTICATED', 'MATCH', 'MATCH_FOUND', 'ACCESS_GRANTED', 'FINGER_MATCH', 'VERIFIED']);
const NO_MATCH_EVENTS  = new Set(['NO_MATCH', 'NOMATCH', 'NOT_FOUND', 'ACCESS_DENIED', 'FINGER_NOT_FOUND']);
const ENROLLED_EVENTS  = new Set(['ENROLLED', 'ENROLL_OK', 'ENROLL_SUCCESS', 'ENROLL_COMPLETE', 'STORED']);
const ENROLL_FAIL_EVENTS = new Set(['ENROLL_FAIL', 'ENROLL_ERROR', 'MISMATCH', 'STORE_FAIL']);
const STEP_EVENTS      = new Set(['ENROLL_STEP', 'PLACE_FINGER', 'LIFT_FINGER', 'PLACE_AGAIN', 'REMOVE_FINGER']);
const READY_EVENTS     = new Set(['READY', 'SENSOR_OK']);

/** Pull the template index out of a packet whatever the firmware calls the field. */
function packetSlot(packet) {
  for (const key of ['fingerId', 'fingerID', 'finger_id', 'id', 'slot']) {
    const raw = packet[key];
    if (raw === undefined || raw === null || raw === '') continue;
    const n = parseInt(raw, 10);
    if (Number.isInteger(n)) return n;
  }
  return null;
}

function packetConfidence(packet) {
  const raw = packet.confidence ?? packet.score ?? null;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) ? n : null;
}

// ── Inbound device events ───────────────────────────────────
async function handleDeviceEvent(packet) {
  // Always surface the raw frame — it is the only window onto unknown firmware.
  broadcast('device', packet);

  const event = String(packet.event || packet.status || '').toUpperCase();
  const slot = packetSlot(packet);

  if (MATCH_EVENTS.has(event)) {
    const confidence = packetConfidence(packet);
    const result = resolveSlot(slot);
    broadcast('scan-result', { ...result, confidence, source: 'hardware' });
    if (result.matched) await publishVerification(result.person, confidence);
    return;
  }

  if (NO_MATCH_EVENTS.has(event)) {
    broadcast('scan-result', {
      matched: false, slot: null, source: 'hardware',
      message: 'No matching fingerprint on the sensor',
    });
    return;
  }

  if (STEP_EVENTS.has(event)) {
    // Either {"event":"ENROLL_STEP","step":"PLACE_FINGER"} or a bare step event.
    const step = String(packet.step || (event === 'ENROLL_STEP' ? '' : event)).toUpperCase() || 'PLACE_FINGER';
    broadcast('enroll-progress', { step, slot: pendingEnrollment?.slot ?? null });
    return;
  }

  if (ENROLLED_EVENTS.has(event)) {
    completeEnrollment(slot ?? pendingEnrollment?.slot ?? null);
    return;
  }

  if (ENROLL_FAIL_EVENTS.has(event) || event === 'ERROR') {
    const message = packet.message || packet.error || event;
    if (pendingEnrollment) {
      broadcast('enroll-result', { success: false, slot: pendingEnrollment.slot, error: message });
      clearEnrollment();
    }
    broadcast('error', { message });
    return;
  }

  if (READY_EVENTS.has(event)) return;   // handled by the bridge's status snapshot

  logger.debug(`[FP] Unrecognised device event: ${event || JSON.stringify(packet)}`);
}

/**
 * Bind the captured slot to the pending person and close the enrollment.
 * Called both by a firmware confirmation and by the operator's manual confirm,
 * so sketches that never announce completion are still usable.
 */
function completeEnrollment(slot) {
  const personId = pendingEnrollment?.person_id ?? null;
  clearEnrollment();

  if (slot == null) {
    broadcast('enroll-result', { success: false, slot: null, error: 'No sensor slot to link' });
    return { success: false, slot: null, error: 'No sensor slot to link' };
  }

  let person = null;
  if (personId) {
    try {
      person = linkFingerprint(personId, slot);
    } catch (err) {
      broadcast('enroll-result', { success: false, slot, error: err.message });
      return { success: false, slot, error: err.message };
    }
  }

  broadcast('enroll-result', { success: true, slot, person });
  return { success: true, slot, person };
}

/**
 * Operator-driven completion — the prototype's "2. Link to DB" button. Use when
 * the sensor captured a print but the firmware never confirmed it.
 */
export function confirmEnrollment({ slot } = {}) {
  const target = slot ?? pendingEnrollment?.slot ?? null;
  if (target == null) {
    throw Object.assign(new Error('No enrollment is in progress and no slot was given'), { status: 400 });
  }
  const result = completeEnrollment(parseInt(target, 10));
  if (!result.success) throw Object.assign(new Error(result.error), { status: 409 });
  return result;
}

async function publishVerification(person, confidence) {
  try {
    await saamp.publishAsClient(
      'smartcamp/persons/verified',
      {
        event: 'fingerprint_verified',
        person,
        confidence: confidence ?? null,
        timestamp: new Date().toISOString(),
      },
      person.mqtt_client_id || `sc-person-${person.id}`,
      person.mqtt_password || '',
      'fingerprint_scanner',
      'verification'
    );
  } catch (err) {
    // Verification is advisory — a broker hiccup must not block the desk.
    logger.warn(`[FP] Verification publish failed: ${err.message}`);
  }
}

function clearEnrollment() {
  pendingEnrollment = null;
  enrollGeneration++;
  if (enrollTimer) { clearTimeout(enrollTimer); enrollTimer = null; }
}

/**
 * Replay a plausible capture sequence through the same handler the real device
 * feeds, so simulated and hardware enrollments share one code path.
 */
function runSimulatedEnrollment(slot) {
  const generation = enrollGeneration;
  const script = [
    [400,  { event: 'ENROLL_STEP', step: 'PLACE_FINGER' }],
    [1400, { event: 'ENROLL_STEP', step: 'LIFT_FINGER' }],
    [2200, { event: 'ENROLL_STEP', step: 'PLACE_AGAIN' }],
    [3200, { event: 'ENROLLED', fingerId: slot }],
  ];

  for (const [delay, packet] of script) {
    const timer = setTimeout(() => {
      if (generation !== enrollGeneration) return; // cancelled or superseded
      handleDeviceEvent(packet).catch(err =>
        logger.error(`[FP] Simulated enrollment failed: ${err.message}`));
    }, delay);
    if (typeof timer.unref === 'function') timer.unref();
  }
}

// ── Scan ────────────────────────────────────────────────────
/**
 * Ask for a scan. With hardware attached this returns immediately with
 * `{ status: 'SCANNING' }` and the real answer arrives on the SSE stream;
 * without hardware it resolves synchronously against the simulator.
 */
export function scanFingerprint({ slot } = {}) {
  if (slot !== undefined && slot !== null && slot !== '') {
    return { ...resolveSlot(slot), source: 'lookup' };
  }

  if (hardware && hardware.connected) {
    hardware.send({ command: 'AUTHENTICATE' });
    return { status: 'SCANNING', message: 'Place finger on the sensor', source: 'hardware' };
  }

  if (!C.FINGERPRINT_SIMULATE) {
    throw Object.assign(new Error('Fingerprint scanner is not connected'), { status: 503 });
  }

  const result = { ...simulateScan(), source: 'simulation' };
  broadcast('scan-result', result);
  return result;
}

/** Demo/offline behaviour: 70% of scans resolve to a random registered person. */
export function simulateScan() {
  const random = Math.random();
  if (random < 0.7) {
    const person = db.prepare(
      'SELECT * FROM persons WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1'
    ).get();
    if (person) return { matched: true, person };
  }
  return { matched: false };
}

// ── Enroll ──────────────────────────────────────────────────
/**
 * Capture a new template on the sensor and (optionally) bind it to a person
 * once the device confirms. Progress streams over SSE.
 */
export function startEnrollment({ person_id, slot } = {}) {
  const simulated = !hardware || !hardware.connected;
  if (simulated && !C.FINGERPRINT_SIMULATE) {
    throw Object.assign(new Error('Fingerprint scanner is not connected'), { status: 503 });
  }
  if (pendingEnrollment) {
    throw Object.assign(new Error('An enrollment is already in progress'), { status: 409 });
  }

  let targetSlot;
  if (slot !== undefined && slot !== null && slot !== '') {
    targetSlot = parseInt(slot, 10);
    if (!Number.isInteger(targetSlot) || targetSlot < 1 || targetSlot > C.FINGERPRINT_MAX_SLOTS) {
      throw Object.assign(new Error(`slot must be between 1 and ${C.FINGERPRINT_MAX_SLOTS}`), { status: 400 });
    }
  } else {
    targetSlot = nextFreeSlot();
  }

  if (person_id) {
    const person = db.prepare('SELECT id FROM persons WHERE id = ? AND is_active = 1').get(person_id);
    if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });
  }

  const occupant = db.prepare(
    'SELECT id, full_name FROM persons WHERE fingerprint_slot = ? AND is_active = 1'
  ).get(targetSlot);
  if (occupant && String(occupant.id) !== String(person_id)) {
    throw Object.assign(
      new Error(`Slot ${targetSlot} is already linked to ${occupant.full_name}`),
      { status: 409 }
    );
  }

  if (!simulated) hardware.send({ command: 'ENROLL', fingerId: targetSlot });

  pendingEnrollment = {
    slot: targetSlot,
    person_id: person_id ? parseInt(person_id, 10) : null,
    started_at: new Date().toISOString(),
  };

  enrollTimer = setTimeout(() => {
    broadcast('enroll-result', { success: false, slot: targetSlot, error: 'Enrollment timed out' });
    clearEnrollment();
  }, ENROLL_TIMEOUT_MS);
  if (typeof enrollTimer.unref === 'function') enrollTimer.unref();

  broadcast('enroll-progress', { step: 'STARTED', slot: targetSlot });
  if (simulated) runSimulatedEnrollment(targetSlot);

  return {
    status: 'ENROLLING',
    slot: targetSlot,
    person_id: pendingEnrollment.person_id,
    source: simulated ? 'simulation' : 'hardware',
  };
}

export function cancelEnrollment() {
  if (!pendingEnrollment) return { cancelled: false };
  const { slot } = pendingEnrollment;
  clearEnrollment();
  try { hardware?.send({ command: 'CANCEL' }); } catch (_) {}
  broadcast('enroll-result', { success: false, slot, error: 'Cancelled by operator' });
  return { cancelled: true, slot };
}

// ── Search ──────────────────────────────────────────────────
export function searchPersons(query) {
  const q = (query || '').trim();
  if (!q) return [];

  const like = `%${q}%`;
  return db.prepare(`
    SELECT p.*, w.barcode AS wristband_barcode
    FROM persons p
    LEFT JOIN wristbands w ON w.person_id = p.id AND w.is_active = 1
    WHERE p.is_active = 1 AND (p.full_name LIKE ? OR p.fingerprint_id LIKE ? OR w.barcode LIKE ?)
    ORDER BY p.created_at DESC
    LIMIT 10
  `).all(like, like, like);
}

// ── Link / unlink ───────────────────────────────────────────
/** Bind a captured sensor slot to a person. Slot is required when hardware is in use. */
export function linkFingerprint(personId, slot) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(personId);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  if (slot === undefined || slot === null || slot === '') {
    throw Object.assign(new Error('slot is required to link a fingerprint'), { status: 400 });
  }

  const n = parseInt(slot, 10);
  if (!Number.isInteger(n) || n < 1 || n > C.FINGERPRINT_MAX_SLOTS) {
    throw Object.assign(new Error(`slot must be between 1 and ${C.FINGERPRINT_MAX_SLOTS}`), { status: 400 });
  }

  const occupant = db.prepare(
    'SELECT id, full_name FROM persons WHERE fingerprint_slot = ? AND is_active = 1'
  ).get(n);
  if (occupant && occupant.id !== person.id) {
    throw Object.assign(
      new Error(`Slot ${n} is already linked to ${occupant.full_name}`),
      { status: 409 }
    );
  }

  db.prepare('UPDATE persons SET fingerprint_slot = ? WHERE id = ?').run(n, person.id);
  logger.info(`[FP] Linked slot ${n} → person ${person.id} (${person.full_name})`);

  return { ...person, fingerprint_slot: n };
}

export function unlinkFingerprint(personId) {
  const person = db.prepare('SELECT * FROM persons WHERE id = ? AND is_active = 1').get(personId);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });

  const slot = person.fingerprint_slot;
  db.prepare('UPDATE persons SET fingerprint_slot = NULL WHERE id = ?').run(person.id);

  // Free the template on the sensor too, so the slot can be reused.
  if (slot != null && hardware && hardware.connected) {
    try { hardware.send({ command: 'DELETE', fingerId: slot }); } catch (err) {
      logger.warn(`[FP] Could not delete template ${slot} on device: ${err.message}`);
    }
  }

  return { ...person, fingerprint_slot: null };
}
