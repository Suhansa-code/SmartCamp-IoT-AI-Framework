// ════════════════════════════════════════════════════════════════════════════
// Design tokens (JS mirror of the Tailwind `@theme` block in globals.css).
// Import from anywhere:  import { C } from '@/components/common/theme'
// ════════════════════════════════════════════════════════════════════════════

export const C = {
  // backgrounds
  navy:        '#0A2540',   // page background (admin)
  navyDeep:    '#071B30',   // header / chrome background
  navyCard:    '#1E3A5F',   // card surfaces
  navyLight:   '#243B5E',   // skeleton / lighter card surface
  panel:       '#0D1F35',   // sub-panel surface
  sky:         '#F0F9FF',   // light page background
  surface:     '#FFFFFF',

  // borders / lines
  border:      '#2D4A70',   // dark chrome border
  line:        '#1E3A5F',   // panel inner border

  // brand accents
  teal:        '#0D9488',
  tealMid:     '#14B8A6',
  tealLight:   '#CCFBF1',
  tealDim:     '#0A6B62',
  coral:       '#F97316',
  coralLight:  '#FED7AA',

  // status
  amber:       '#F59E0B',
  warn:        '#F59E0B',
  yellow:      '#FACC15',
  green:       '#22C55E',
  good:        '#22C55E',
  red:         '#F87171',
  danger:      '#EF4444',
  offline:     '#EF4444',
  purple:      '#A78BFA',
  blue:        '#60A5FA',
  weak:        '#F59E0B',
  poor:        '#F97316',
  routine:     '#4A90D9',

  // text
  text:        '#E2E8F0',
  textPrimary: '#FFFFFF',
  muted:       '#94A3B8',
  dim:         '#94A3B8',
  slate:       '#64748B',
}

export const stateColor = (s) =>
  ({ GOOD: C.good, WEAK: C.weak, POOR: C.poor, OFFLINE: C.offline }[s] || C.good)

export const priorityColor = (p) =>
  ({ CRITICAL: C.offline, IMPORTANT: C.weak, ROUTINE: '#4a90d9' }[p] || C.muted)

export const valColor = (v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5
  return bad ? C.offline : warn2 ? C.weak : C.good
}