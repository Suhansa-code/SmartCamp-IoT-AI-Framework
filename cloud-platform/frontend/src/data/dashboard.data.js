// Dashboard demo fallbacks (shown when the cloud backend is unreachable)
// plus status maps shared by the dashboard widgets.

import { P } from './theme.data'

export const MOCK_CAMPS = [
  { id: 'hmg',  name: 'Homagama Relief',    code: 'HMG', location: 'Colombo',       childCount: 214, sessionCount: 128, alerts: [{}, {}],       updated: 4 },
  { id: 'gal',  name: 'Galle Seafront',     code: 'GAL', location: 'Galle',         childCount: 178, sessionCount: 96,  alerts: [{}],           updated: 12 },
  { id: 'rtp',  name: 'Rathnapura Valley',  code: 'RTP', location: 'Sabaragamuwa',  childCount: 242, sessionCount: 151, alerts: [{}, {}, {}],   updated: 2 },
  { id: 'mat',  name: 'Matara East',        code: 'MAT', location: 'Matara',        childCount: 156, sessionCount: 88,  alerts: [],             updated: 26 },
  { id: 'kal',  name: 'Kalutara South',     code: 'KAL', location: 'Kalutara',      childCount: 190, sessionCount: 117, alerts: [{}, {}],       updated: 9 },
  { id: 'bat',  name: 'Batticaloa North',   code: 'BAT', location: 'Eastern',       childCount: 205, sessionCount: 132, alerts: [{}],           updated: 1 },
]

export const MOCK_EDUCATION = [
  { id: 'CAMP-B-HOMAGAMA',   children: 214, sessions: 468, avg_composite: 68.5, flagged_sessions: 17, total_alerts: 6,  pending_alerts: 2, grade_distribution: [{ grade: 3, count: 128 }, { grade: 4, count: 86 }] },
  { id: 'CAMP-B-GALLE',      children: 178, sessions: 352, avg_composite: 64.2, flagged_sessions: 11, total_alerts: 3,  pending_alerts: 1, grade_distribution: [{ grade: 3, count: 97 }, { grade: 4, count: 81 }] },
  { id: 'CAMP-B-RATHNAPURA', children: 242, sessions: 531, avg_composite: 61.8, flagged_sessions: 29, total_alerts: 9,  pending_alerts: 4, grade_distribution: [{ grade: 3, count: 141 }, { grade: 4, count: 101 }] },
  { id: 'CAMP-B-MATARA',     children: 156, sessions: 288, avg_composite: 71.4, flagged_sessions: 6,  total_alerts: 1,  pending_alerts: 0, grade_distribution: [{ grade: 3, count: 88 }, { grade: 4, count: 68 }] },
  { id: 'CAMP-B-KALUTARA',   children: 190, sessions: 374, avg_composite: 66.9, flagged_sessions: 14, total_alerts: 4,  pending_alerts: 1, grade_distribution: [{ grade: 3, count: 112 }, { grade: 4, count: 78 }] },
  { id: 'CAMP-B-BATTICALOA', children: 205, sessions: 449, avg_composite: 58.7, flagged_sessions: 33, total_alerts: 12, pending_alerts: 3, grade_distribution: [{ grade: 3, count: 120 }, { grade: 4, count: 85 }] },
]

export const MOCK_RESOURCES = {
  population: { total: 1185, families: 402, today_registered: 14, today_checkins: 986, attendance_rate_pct: 83 },
  vulnerable: { total_flagged: 23, pregnant: 9, chronic_illness: 14 },
  distribution_today: {
    breakfast: { served: 912, prepared: 960 },
    lunch:     { served: 884, prepared: 960 },
    dinner:    { served: 861, prepared: 960 },
    water:     { served: 1280, prepared: 1440 },
  },
  eligible_for_distribution: 960,
  prediction_tomorrow: {
    expected_persons: 1170, attendance_rate_pct: 84, expected_new_arrivals: 8,
    breakfast_kg: 96, lunch_kg: 128, dinner_kg: 118, water_litres: 1520,
    confidence: 'High', days_of_data: 21,
  },
  mqtt: { network_state: 'GOOD', buffered_messages: 0 },
}

export const MOCK_DISASTER = {
  camps: [
    { id: 'galle',       code: 'GAL', name: 'Galle Flood Emergency',    type: 'FLOOD',     status: 'critical', displaced: 3840, workers: 124 },
    { id: 'batticaloa',  code: 'BTC', name: 'Batticaloa Cyclone Camp',  type: 'CYCLONE',   status: 'high',     displaced: 2215, workers: 88 },
    { id: 'kandy',       code: 'KDY', name: 'Kandy Landslide Relief',   type: 'LANDSLIDE', status: 'high',     displaced: 1620, workers: 76 },
    { id: 'colombo',     code: 'CMB', name: 'Colombo Urban Relief',     type: 'FLOOD',     status: 'medium',   displaced: 540,  workers: 38 },
    { id: 'trinco',      code: 'TRC', name: 'Trincomalee Flood Camp',   type: 'FLOOD',     status: 'stable',   displaced: 620,  workers: 47 },
    { id: 'kurunegala',  code: 'KUR', name: 'Kurunegala Relief',        type: 'FLOOD',     status: 'recovery', displaced: 275,  workers: 21 },
  ],
}

// Dashboard camp code → disaster camp id (geographic match).
export const DISASTER_MATCH = { HMG: null, GAL: 'galle', RTP: 'ratnapura', MAT: 'matara', KAL: null, BAT: 'batticaloa' }

export const CAMP_STATUS = {
  clear:  { label: 'Clear',  color: P.green },
  watch:  { label: 'Watch',  color: P.amber },
  urgent: { label: 'Urgent', color: P.red },
}

export const DIS_STATUS = {
  critical: { label: 'Critical', color: '#DC2626' },
  high:     { label: 'High',     color: '#D97706' },
  medium:   { label: 'Medium',   color: '#F59E0B' },
  stable:   { label: 'Stable',   color: '#16A34A' },
  recovery: { label: 'Recovery', color: '#16A34A' },
}