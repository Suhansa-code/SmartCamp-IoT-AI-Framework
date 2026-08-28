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

// TEMPORARY: Boost PAGES priority for testing. Revert after testing.
const PAGES_BOOST = true; // Set to false to revert to original priorities

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

    // ── pages_behavioral_signals — session metrics, TEMPORARY boost for testing ─────
    case 'pages_behavioral_signals':
      return PAGES_BOOST ? hi('behavioral_signal_boosted') : lo('behavioral_signal');

    // ── pages_content_responses — per-task answers, TEMPORARY boost for testing ─────
    case 'pages_content_responses':
      return PAGES_BOOST ? hi('content_response_boosted') : lo('content_response');

    // ── Disaster tables ───────────────────────────────────────────
    case 'disaster_alerts':
      return classifyDisasterAlert(row);
    case 'flood_predictions':
      return classifyFloodPrediction(row);
    case 'water_level_readings':
      return classifyWaterLevel(row);
    case 'disaster_events':
      return classifyDisasterEvent(row);
    case 'weather_data':
      return md('weather_data');
    case 'gps_readings':
      return md('gps_readings');
    case 'hydrospatial_data':
      return md('hydrospatial_data');
    case 'prediction_requests':
      return md('prediction_request');

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
  // TEMPORARY: Boost PAGES priority for testing
  if (PAGES_BOOST) return hi('session_boosted');
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
  // TEMPORARY: Boost PAGES priority for testing
  if (PAGES_BOOST) return hi('gate_boosted');
  if (row.decision === 'FAIL_CONFIRMED') return hi('gate_fail_confirmed');
  if (row.decision === 'FAIL_FIRST') return md('gate_fail_first');
  return lo('gate_pass');
}

function classifyPerson(row) {
  // Registration is CRITICAL regardless of who the person is. It is the only
  // record that cannot be rebuilt from later traffic — a check-in or a
  // distribution referencing a person the cloud has never seen is orphaned.
  // Vulnerability flags are kept only as the stated reason.
  if (row.is_pregnant) return crit('person_pregnant');
  if (row.has_chronic_illness) return crit('person_chronic');
  if (row.age != null && row.age < 18) return crit('person_child');
  return crit('person_registration');
}

function classifyDistribution(row) {
  // Deliberately uniform: distribution is routine operational data whatever
  // was handed out. The medicine/water/food split used to promote a medicine
  // hand-out to CRITICAL, which put it ahead of registration in the flush
  // queue and let it publish during an outage. One rule, nothing hidden.
  return md('distribution');
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
  // TEMPORARY: Boost PAGES priority for testing
  if (PAGES_BOOST) return hi('child_boosted');
  // Very low baseline → HIGH (needs attention)
  if (row.baseline_score != null && row.baseline_score < 40) return hi('child_low_baseline');
  // Active alerts → HIGH
  if (row.alert_status === 'active') return hi('child_alert_active');
  // Consecutive low flagged → HIGH
  if (row.consecutive_low != null && row.consecutive_low >= 2) return hi('child_consecutive_low');
  // Normal enrollment → LOW
  return lo('child_enrolled');
}

// ── Disaster classifiers ────────────────────────────────────────────────

function classifyDisasterAlert(row) {
  const severity = (row.severity || '').toUpperCase();
  if (severity === 'CRITICAL' || severity === 'EXTREME') return crit('disaster_alert_critical');
  if (severity === 'HIGH' || severity === 'SEVERE') return hi('disaster_alert_high');
  return md('disaster_alert_normal');
}

function classifyFloodPrediction(row) {
  const category = (row.flood_category || '').toLowerCase();
  if (category.includes('high') || category.includes('severe') || category.includes('extreme')) {
    return crit('flood_prediction_critical');
  }
  if (row.flood_probability != null && row.flood_probability >= 0.7) {
    return crit('flood_prediction_high_prob');
  }
  return hi('flood_prediction');
}

function classifySensorReading(row) {
  const type = (row.sensor_type || '').toLowerCase();
  if (type.includes('water') || type.includes('flood') || type.includes('rain')) {
    return hi('sensor_water');
  }
  return hi('sensor_reading');
}

function classifyWaterLevel(row) {
  if (row.water_level != null && row.water_level > 5) return hi('water_level_high');
  return hi('water_level');
}

function classifyDisasterEvent(row) {
  const status = (row.status || '').toUpperCase();
  const severity = (row.severity || '').toUpperCase();
  if (status === 'ACTIVE' && (severity === 'CRITICAL' || severity === 'EXTREME')) {
    return crit('disaster_event_critical');
  }
  if (status === 'ACTIVE') return hi('disaster_event_active');
  return md('disaster_event_inactive');
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
    persons:               PRIORITY.CRITICAL,
    distributions:         PRIORITY.MEDIUM,
    camp_checkins:         PRIORITY.HIGH,
    wristbands:            PRIORITY.HIGH,
    audit_logs:            PRIORITY.LOW,
    // TEMPORARY: Boost PAGES tables for testing
    pages_children:        PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    pages_sessions:        PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    pages_behavioral_signals: PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    pages_content_responses:  PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    pages_gate_decisions:  PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    pages_alerts:          PAGES_BOOST ? PRIORITY.HIGH : PRIORITY.LOW,
    disaster_alerts:       PRIORITY.CRITICAL,
    flood_predictions:     PRIORITY.CRITICAL,
    water_level_readings:  PRIORITY.HIGH,
    disaster_events:       PRIORITY.HIGH,
    weather_data:          PRIORITY.MEDIUM,
    gps_readings:          PRIORITY.MEDIUM,
    hydrospatial_data:     PRIORITY.MEDIUM,
    prediction_requests:   PRIORITY.MEDIUM,
  };
  const p = TABLE_DEFAULTS[tableName] || PRIORITY.MEDIUM;
  return { priority: p, qos: QOS_MAP[p] };
}

export { PRIORITY, PRIORITY_ORDER, QOS_MAP };
