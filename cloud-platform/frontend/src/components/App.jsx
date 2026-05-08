export const C = {
  panel:    '#0d1520',
  border:   '#2a3f5a',
  text:     '#f1f5f9',
  muted:    '#94a3b8',
  good:     '#22c55e',
  weak:     '#f59e0b',
  poor:     '#f97316',
  offline:  '#ef4444',
  routine:  '#4a90d9',
};

export const stateColor = s => ({
  GOOD:C.good, WEAK:C.weak, POOR:C.poor, OFFLINE:C.offline
}[s] || C.good);

export const priorityColor = p => ({
  CRITICAL: C.offline, IMPORTANT: C.weak, ROUTINE: '#4a90d9'
}[p] || C.muted);

export const valColor = (v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit;
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5;
  return bad ? C.offline : warn2 ? C.weak : C.good;
};
