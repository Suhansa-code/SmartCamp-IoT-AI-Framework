// Education domain data — display metadata for known camp ids and
// demo fallback summaries shown when the cloud backend is unreachable.

export const CAMP_META = {
  "CAMP-B-HOMAGAMA": { name: "Homagama Relief", location: "Colombo", code: "HMG" },
  "CAMP-B-GALLE": { name: "Galle Seafront", location: "Galle", code: "GAL" },
  "CAMP-B-RATHNAPURA": { name: "Rathnapura Valley", location: "Sabaragamuwa", code: "RTP" },
  "CAMP-B-MATARA": { name: "Matara East", location: "Matara", code: "MAT" },
  "CAMP-B-KALUTARA": { name: "Kalutara South", location: "Kalutara", code: "KAL" },
  "CAMP-B-BATTICALOA": { name: "Batticaloa North", location: "Eastern", code: "BAT" },
}

export const MOCK_CAMPS = [
  {
    id: "CAMP-B-HOMAGAMA",
    children: 214,
    sessions: 468,
    avg_composite: 68.5,
    flagged_sessions: 17,
    total_alerts: 6,
    pending_alerts: 2,
    grade_distribution: [
      { grade: 3, count: 128 },
      { grade: 4, count: 86 },
    ],
  },
  {
    id: "CAMP-B-GALLE",
    children: 178,
    sessions: 352,
    avg_composite: 64.2,
    flagged_sessions: 11,
    total_alerts: 3,
    pending_alerts: 1,
    grade_distribution: [
      { grade: 3, count: 97 },
      { grade: 4, count: 81 },
    ],
  },
  {
    id: "CAMP-B-RATHNAPURA",
    children: 242,
    sessions: 531,
    avg_composite: 61.8,
    flagged_sessions: 29,
    total_alerts: 9,
    pending_alerts: 4,
    grade_distribution: [
      { grade: 3, count: 141 },
      { grade: 4, count: 101 },
    ],
  },
  {
    id: "CAMP-B-MATARA",
    children: 156,
    sessions: 288,
    avg_composite: 71.4,
    flagged_sessions: 6,
    total_alerts: 1,
    pending_alerts: 0,
    grade_distribution: [
      { grade: 3, count: 88 },
      { grade: 4, count: 68 },
    ],
  },
  {
    id: "CAMP-B-KALUTARA",
    children: 190,
    sessions: 374,
    avg_composite: 66.9,
    flagged_sessions: 14,
    total_alerts: 4,
    pending_alerts: 1,
    grade_distribution: [
      { grade: 3, count: 112 },
      { grade: 4, count: 78 },
    ],
  },
  {
    id: "CAMP-B-BATTICALOA",
    children: 205,
    sessions: 449,
    avg_composite: 58.7,
    flagged_sessions: 33,
    total_alerts: 12,
    pending_alerts: 3,
    grade_distribution: [
      { grade: 3, count: 120 },
      { grade: 4, count: 85 },
    ],
  },
]