/**
 * sync-priority.js — Determine synchronization priority based on DATA CONTENT.
 *
 * Priority is NOT based on table name. The same table may contain rows with
 * different priorities depending on the event/data type.
 *
 * Priority levels:
 *   CRITICAL — disaster events, active flood/disaster, emergency alerts
 *   HIGH     — person registration, check-in, critical distributions
 *   MEDIUM   — normal resource/inventory, usage, operational data
 *   LOW      — education sessions, behavioral details, historical data
 *
 * Processing order: CRITICAL → HIGH → MEDIUM → LOW
 * Within same priority: oldest record first (by created_at / timestamp)
 */

const PRIORITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

const PRIORITY_ORDER = [PRIORITY.CRITICAL, PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW];

/**
 * Base QoS per priority — matches SAAMP conventions.
 * Used by sync-manager when publishing via saamp.publish().
 */
const QOS_MAP = {
  CRITICAL: 2,
  HIGH: 1,
  MEDIUM: 1,
  LOW: 0,
};

/**
 * Classify a single row's sync priority based on its data content.
 *
 * @param {string} tableName - The table the row belongs to
 * @param {object} row - The row data from SQLite
 * @returns {{ priority: string, qos: number, reason: string }}
 */
export function classifyRowPriority(tableName, row) {
  if (!row) return { priority: PRIORITY.MEDIUM, qos: QOS_MAP[PRIORITY.MEDIUM], reason: 'null_row' };

  switch (tableName) {
    // ── pages_alerts — check severity ──────────────────────────────
    case 'pages_alerts':
      return classifyAlert(row);

    // ── pages_sessions — check anomaly/gate ────────────────────────
    case 'pages_sessions':
      return classifySession(row);

    // ── pages_gate_decisions — check decision type ─────────────────
    case 'pages_gate_decisions':
      return classifyGateDecision(row);

    // ── persons — check vulnerability flags ────────────────────────
    case 'persons':
      return classifyPerson(row);

    // ── distributions — check resource criticality ─────────────────
    case 'distributions':
      return classifyDistribution(row);

    // ── camp_checkins — always HIGH (operational, time-sensitive) ──
    case 'camp_checkins':
      return hi('checkin');

    // ── wristbands — always HIGH (operational) ────────────────────
    case 'wristbands':
      return hi('wristband');

    // ── resources — inventory changes ──────────────────────────────
    case 'resources':
      return classifyResource(row);

    // ── resource_usage — consumption records ───────────────────────
    case 'resource_usage':
      return md('resource_usage');

    // ── audit_logs — historical/background ─────────────────────────
    case 'audit_logs':
      return lo('audit_log');

    // ── pages_children — enrollment, may be CRITICAL if young/vulnerable ─
    case 'pages_children':
      return classifyChild(row);

    // ── pages_behavioral_signals — session metrics, always LOW ─────
    case 'pages_behavioral_signals':
      return lo('behavioral_signal');

    // ── pages_content_responses — per-task answers, always LOW ─────
    case 'pages_content_responses':
      return lo('content_response');

    default:
      return md('unknown_table');
  }
}

// ── Per-table classifiers ─────────────────────────────────────────────────

function classifyAlert(row) {
  // Resolved alerts are MEDIUM regardless of type — already handled
  if (row.status === 'resolved') return md('alert_resolved');
  const type = row.alert_type || '';
  // 3 consecutive flagged = child at risk → CRITICAL
  if (type.includes('consecutive')) return crit('alert_consecutive');
  // 3 of 5 flagged → CRITICAL
  if (type.includes('of_5')) return crit('alert_of_5');
  // Any pending alert → HIGH
  return hi('alert_pending');
}

function classifySession(row) {
  // Anomaly flagged = potential learning difficulty → HIGH
  if (row.anomaly_flagged) return hi('session_anomaly');
  // FAIL_CONFIRMED gate = needs attention → HIGH
  if (row.gate_decision === 'FAIL_CONFIRMED') return hi('session_gate_fail');
  // FAIL_FIRST = caution → MEDIUM
  if (row.gate_decision === 'FAIL_FIRST') return md('session_gate_first_fail');
  // Normal session → LOW
  return lo('session_normal');
}

function classifyGateDecision(row) {
  if (row.decision === 'FAIL_CONFIRMED') return hi('gate_fail_confirmed');
  if (row.decision === 'FAIL_FIRST') return md('gate_fail_first');
  return lo('gate_pass');
}

function classifyPerson(row) {
  // Pregnant or chronic illness → CRITICAL (vulnerable person)
  if (row.is_pregnant) return crit('person_pregnant');
  if (row.has_chronic_illness) return crit('person_chronic');
  // Child (age < 18) → HIGH
  if (row.age != null && row.age < 18) return hi('person_child');
  // Normal adult registration → HIGH
  return hi('person_adult');
}

function classifyDistribution(row) {
  const type = (row.resource_type || '').toLowerCase();
  // Medicine distribution → CRITICAL
  if (type === 'medicine' || type === 'paracetamol' || type === 'medical') {
    return crit('distribution_medicine');
  }
  // Water in disaster context → HIGH
  if (type === 'water') return hi('distribution_water');
  // Food distributions → HIGH
  return hi('distribution_food');
}

function classifyResource(row) {
  // Below minimum threshold → HIGH (restocking needed)
  if (row.available_quantity != null && row.minimum_threshold != null
      && row.available_quantity <= row.minimum_threshold) {
    return hi('resource_low_stock');
  }
  return md('resource_normal');
}

function classifyChild(row) {
  // Very low baseline → HIGH (needs attention)
  if (row.baseline_score != null && row.baseline_score < 40) return hi('child_low_baseline');
  // Active alerts → HIGH
  if (row.alert_status === 'active') return hi('child_alert_active');
  // Consecutive low flagged → HIGH
  if (row.consecutive_low != null && row.consecutive_low >= 2) return hi('child_consecutive_low');
  // Normal enrollment → LOW
  return lo('child_enrolled');
}

// ── Helpers ──────────────────────────────────────────────────────────────

function crit(reason) {
  return { priority: PRIORITY.CRITICAL, qos: QOS_MAP[PRIORITY.CRITICAL], reason };
}

function hi(reason) {
  return { priority: PRIORITY.HIGH, qos: QOS_MAP[PRIORITY.HIGH], reason };
}

function md(reason) {
  return { priority: PRIORITY.MEDIUM, qos: QOS_MAP[PRIORITY.MEDIUM], reason };
}

function lo(reason) {
  return { priority: PRIORITY.LOW, qos: QOS_MAP[PRIORITY.LOW], reason };
}

/**
 * Compare two rows for sorting: CRITICAL → HIGH → MEDIUM → LOW, then oldest first.
 * Each row must have _priority attached by classifyRowPriority().
 *
 * Returns negative if a should come before b (higher priority / older).
 */
export function comparePriority(a, b) {
  const ia = PRIORITY_ORDER.indexOf(a._priority);
  const ib = PRIORITY_ORDER.indexOf(b._priority);
  if (ia !== ib) return ia - ib; // higher priority first (lower index)
  // Same priority → oldest first (ascending created_at)
  const ta = a._timestamp || '';
  const tb = b._timestamp || '';
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

/**
 * Get the priority order index for a priority string.
 * Used by sorting and batch grouping.
 */
export function priorityIndex(priority) {
  return PRIORITY_ORDER.indexOf(priority);
}

/**
 * Returns { priority, qos } for a table-level default.
 * Used by sync-manager for topic-level classifyMessage mapping.
 */
export function getTableDefaultPriority(tableName) {
  // These tables always have the same default priority
  const TABLE_DEFAULTS = {
    camp_checkins:         PRIORITY.HIGH,
    wristbands:            PRIORITY.HIGH,
    audit_logs:            PRIORITY.LOW,
    pages_behavioral_signals: PRIORITY.LOW,
    pages_content_responses:  PRIORITY.LOW,
  };
  const p = TABLE_DEFAULTS[tableName] || PRIORITY.MEDIUM;
  return { priority: p, qos: QOS_MAP[p] };
}

export { PRIORITY, PRIORITY_ORDER, QOS_MAP };
