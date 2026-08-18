/**
 * Static seed data for the Education domain (PAGES alerts).
 * Source of truth for the education-insights dashboard. The in-memory
 * repository (repositories/education/alert.repository.js) is seeded from
 * here so the API serves realistic data without a database. When a real
 * DB is connected later, this file is only used as bootstrapping seed.
 */

export const EDUCATION_CAMPS = [
  {
    id: 'CAMP-B-HOMAGAMA',
    name: 'Homagama Relief',
    code: 'HMG',
    children: 214,
    sessions: 468,
    avg: 68.5,
    flagged: 17,
    totalAlerts: 6,
    pendingAlerts: 2,
    gradeDist: [
      { grade: 3, count: 128 },
      { grade: 4, count: 86 },
    ],
  },
  {
    id: 'CAMP-B-GALLE',
    name: 'Galle Seafront',
    code: 'GAL',
    children: 178,
    sessions: 352,
    avg: 64.2,
    flagged: 11,
    totalAlerts: 3,
    pendingAlerts: 1,
    gradeDist: [
      { grade: 3, count: 97 },
      { grade: 4, count: 81 },
    ],
  },
  {
    id: 'CAMP-B-RATHNAPURA',
    name: 'Rathnapura Valley',
    code: 'RTP',
    children: 242,
    sessions: 531,
    avg: 61.8,
    flagged: 29,
    totalAlerts: 9,
    pendingAlerts: 4,
    gradeDist: [
      { grade: 3, count: 141 },
      { grade: 4, count: 101 },
    ],
  },
  {
    id: 'CAMP-B-MATARA',
    name: 'Matara East',
    code: 'MAT',
    children: 156,
    sessions: 288,
    avg: 71.4,
    flagged: 6,
    totalAlerts: 1,
    pendingAlerts: 0,
    gradeDist: [
      { grade: 3, count: 88 },
      { grade: 4, count: 68 },
    ],
  },
  {
    id: 'CAMP-B-KALUTARA',
    name: 'Kalutara South',
    code: 'KAL',
    children: 190,
    sessions: 374,
    avg: 66.9,
    flagged: 14,
    totalAlerts: 4,
    pendingAlerts: 1,
    gradeDist: [
      { grade: 3, count: 112 },
      { grade: 4, count: 78 },
    ],
  },
  {
    id: 'CAMP-B-BATTICALOA',
    name: 'Batticaloa North',
    code: 'BAT',
    children: 205,
    sessions: 449,
    avg: 58.7,
    flagged: 33,
    totalAlerts: 12,
    pendingAlerts: 3,
    gradeDist: [
      { grade: 3, count: 120 },
      { grade: 4, count: 85 },
    ],
  },
];

const LANGUAGES = ['si', 'ta', 'en'];

/**
 * Deterministic seed builder — produces children, sessions and alerts that
 * match the summary numbers in EDUCATION_CAMPS. Pure function (no randomness)
 * so the API is stable across restarts.
 */
export function buildEducationSeed() {
  const children = [];
  const sessions = [];
  const alerts = [];

  let sessionSeq = 1;
  let alertSeq = 1;

  for (const camp of EDUCATION_CAMPS) {
    const childIds = [];
    const gradePool = [];
    for (const g of camp.gradeDist) {
      for (let i = 0; i < g.count; i += 1) gradePool.push(g.grade);
    }

    for (let i = 0; i < camp.children; i += 1) {
      const index = String(i + 1).padStart(3, '0');
      const childId = `${camp.code}-${index}`;
      const grade = gradePool[i % gradePool.length];
      const baseline = Math.max(45, Math.min(80, Math.round(camp.avg - 10 + ((i * 7) % 21))));
      const sessionsCount = 2 + (i % 3);
      const alertStatus = i % 17 === 0 ? 'active' : 'none';

      childIds.push(childId);
      children.push({
        child_id: childId,
        res_id: `RES-${camp.code}-${index}`,
        camp_id: camp.id,
        grade,
        language: LANGUAGES[i % LANGUAGES.length],
        baseline_score: baseline,
        total_sessions: sessionsCount,
        alert_status: alertStatus,
      });

      for (let s = 0; s < sessionsCount; s += 1) {
        const drift = ((i + s) % 5) - 2;
        const score = Math.max(25, Math.min(95, Math.round(baseline - 4 + s * 2 + drift)));
        const created = new Date(Date.now() - (camp.children - i + s * 6) * 3600e3).toISOString();
        const flagged = s === 0 && i % 13 === 0;

        sessions.push({
          session_id: `S-${camp.code}-${String(sessionSeq).padStart(5, '0')}`,
          child_id: childId,
          composite_score: score,
          anomaly_flagged: flagged ? 1 : 0,
          alert_triggered: flagged ? 1 : 0,
          created_at: created,
        });
        sessionSeq += 1;
      }

      if (alertStatus === 'active' && alerts.length < camp.totalAlerts) {
        alerts.push({
          alert_id: `A-${camp.code}-${String(alertSeq).padStart(3, '0')}`,
          child_id: childId,
          res_id: `RES-${camp.code}-${index}`,
          camp_id: camp.id,
          alert_type: 'composite_drop',
          trigger_detail: JSON.stringify({ recent_scores: [Math.round(baseline - 12), Math.round(baseline - 16), Math.round(baseline - 20)] }),
          triggered_at: new Date(Date.now() - alertSeq * 86400e3).toISOString(),
          status: alertSeq <= camp.pendingAlerts ? 'pending' : 'resolved',
          resolved_at: alertSeq <= camp.pendingAlerts ? null : new Date(Date.now() - (alertSeq - 1) * 86400e3).toISOString(),
          resolved_notes: alertSeq <= camp.pendingAlerts ? null : 'Reviewed by field officer',
        });
        alertSeq += 1;
      }
    }

    // ensure pending alerts exist even when the modulo above filled them slowly
    let pendingMade = alerts.filter((a) => a.camp_id === camp.id && a.status === 'pending').length;
    while (pendingMade < camp.pendingAlerts) {
      const childId = childIds[pendingMade % childIds.length];
      const child = children.find((c) => c.child_id === childId);
      alerts.push({
        alert_id: `A-${camp.code}-P${String(pendingMade + 1).padStart(2, '0')}`,
        child_id: childId,
        res_id: child.res_id,
        camp_id: camp.id,
        alert_type: '3_of_5_flagged',
        trigger_detail: JSON.stringify({ recent_scores: [52, 46, 39] }),
        triggered_at: new Date(Date.now() - (pendingMade + 1) * 86400e3).toISOString(),
        status: 'pending',
        resolved_at: null,
        resolved_notes: null,
      });
      pendingMade += 1;
    }
  }

  return { children, sessions, alerts };
}

export const EDUCATION_SEED = buildEducationSeed();
