// ════════════════════════════════════════════════════════════════════════════
// Design tokens (JS mirror of the Tailwind `@theme` block in globals.css).
// Import from anywhere:  import { C } from '@/components/common/theme'
// Professional disaster-management palette — calm, trustworthy, modern.
// ════════════════════════════════════════════════════════════════════════════

export const C = {
  // backgrounds
  navy:        '#1E3A5F',   // page background (admin)
  navyDeep:    '#162D4A',   // header / chrome background
  navyCard:    '#1E3A5F',   // card surfaces
  navyLight:   '#2A4A6E',   // skeleton / lighter card surface
  panel:       '#0F2A45',   // sub-panel surface
  sky:         '#F0F4F8',   // light page background
  surface:     '#FFFFFF',

  // borders / lines
  border:      '#334155',   // dark chrome border
  line:        '#1E3A5F',   // panel inner border

  // brand accents — professional blue primary
  teal:        '#2563EB',   // primary accent (blue)
  tealMid:     '#3B82F6',   // mid blue
  tealLight:   '#DBEAFE',   // light blue tint
  tealDim:     '#1D4ED8',   // deep blue
  coral:       '#475569',   // secondary accent (slate)
  coralLight:  '#E2E8F0',   // light slate tint

  // status
  amber:       '#D97706',   // warning amber
  warn:        '#D97706',
  yellow:      '#F59E0B',   // amber-500
  green:       '#16A34A',   // success green
  good:        '#16A34A',
  red:         '#DC2626',   // danger red
  danger:      '#DC2626',
  offline:     '#DC2626',
  purple:      '#2563EB',   // info blue (replaces purple)
  blue:        '#0891B2',   // info cyan
  weak:        '#D97706',
  poor:        '#DC2626',
  routine:     '#475569',

  // text
  text:        '#E2E8F0',
  textPrimary: '#FFFFFF',
  muted:       '#94A3B8',
  dim:         '#94A3B8',
  slate:       '#64748B',
}

// ── Semantic theme tokens (dark + light) ─────────────────────────────────────
// `T` from useTheme() resolves to one of these. Every key in C is included plus
// semantic aliases (bg / bgDeep / bgSoft / card / bar / text) so pages can switch
// light/dark by swapping `C.` → `T.` and updating hard-coded hex literals.
export const DARK = {
  mode: 'dark',
  bg:        '#0F172A',
  bgDeep:    '#1E293B',
  bgSoft:    '#1A2332',
  outer:     '#0F172A',
  card:      '#1E293B',
  cardSolid: '#172033',
  cardSoft:  '#253449',
  bar:       '#253449',
  border:    '#334155',
  line:      '#1E293B',
  panel:     '#1A2332',
  panelSoft: '#253449',
  text:      '#CBD5E1',
  textPrimary: '#F1F5F9',
  textSoft:  '#E2E8F0',
  ink:       '#F1F5F9',
  inkSoft:   '#94A3B8',
  muted:     '#94A3B8',
  dim:       '#64748B',
  slate:     '#475569',
  teal:      C.teal,   tealMid: C.tealMid, tealLight: C.tealLight, tealDim: C.tealDim,
  coral:     C.coral,  coralLight: C.coralLight,
  amber:     C.amber,  warn: C.warn,  yellow: C.yellow,
  green:     C.green,  good: C.green,
  orange:    '#D97706',
  lime:      '#16A34A',
  red:       C.red,    danger: C.red, offline: C.offline,
  purple:    C.purple, blue: C.blue,
  weak:      C.weak,   poor: C.poor,  routine: C.routine,
  navy:      '#0F172A', navyDeep: '#1E293B', navyCard: '#1E293B', navyLight: '#253449',
  sky: '#0F172A',   surface: '#FFFFFF',
}

export const LIGHT = {
  mode: 'light',
  bg:        '#F8FAFC',
  bgDeep:    '#FFFFFF',
  bgSoft:    '#FFFFFF',
  outer:     '#F8FAFC',
  card:      '#FFFFFF',
  cardSolid: '#FFFFFF',
  cardSoft:  '#F8FAFC',
  bar:       '#F1F5F9',
  border:    '#E2E8F0',
  line:      '#E2E8F0',
  panel:     '#FFFFFF',
  panelSoft: '#F8FAFC',
  text:      '#1E3A5F',
  textPrimary: '#0F172A',
  textSoft:  '#0F172A',
  ink:       '#0F172A',
  inkSoft:   '#475569',
  muted:     '#475569',
  dim:       '#64748B',
  slate:     '#64748B',
  teal:      '#2563EB', tealMid: '#3B82F6', tealLight: '#DBEAFE', tealDim: '#1D4ED8',
  coral:     '#475569', coralLight: '#E2E8F0',
  amber:     '#D97706', warn: '#D97706', yellow: '#F59E0B',
  green:     '#16A34A', good: '#16A34A',
  orange:    '#D97706',
  lime:      '#16A34A',
  red:       '#DC2626', danger: '#DC2626', offline: '#DC2626',
  purple:    '#2563EB', blue: '#0891B2',
  weak:      '#D97706', poor: '#DC2626', routine: '#475569',
  navy:      '#F8FAFC', navyDeep: '#FFFFFF', navyCard: '#FFFFFF', navyLight: '#F8FAFC',
  sky: '#F8FAFC', surface: '#FFFFFF',
}

export const stateColor = (T, s) =>
  ({ GOOD: T.good, WEAK: T.weak, POOR: T.poor, OFFLINE: T.offline }[s] || T.good)

export const priorityColor = (T, p) =>
  ({ CRITICAL: T.offline, IMPORTANT: T.weak, ROUTINE: T.routine }[p] || T.muted)

export const valColor = (T, v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5
  return bad ? T.offline : warn2 ? T.weak : T.good
}
