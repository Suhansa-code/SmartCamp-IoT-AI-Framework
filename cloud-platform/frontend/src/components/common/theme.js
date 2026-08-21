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

// ── Semantic theme tokens (dark + light) ─────────────────────────────────────
// `T` from useTheme() resolves to one of these. Every key in C is included plus
// semantic aliases (bg / bgDeep / bgSoft / card / bar / text) so pages can switch
// light/dark by swapping `C.` → `T.` and updating hard-coded hex literals.
export const DARK = {
  mode: 'dark',
  bg:        '#0A0A0B',
  bgDeep:    '#121214',
  bgSoft:    '#0E0E10',
  outer:     '#0A0A0B',
  card:      '#131316',
  cardSolid: '#0F0F11',
  cardSoft:  '#1A1A1E',
  bar:       '#1A1A1E',
  border:    '#26262B',
  line:      '#1E1E23',
  panel:     '#0E0E10',
  panelSoft: '#1A1A1E',
  text:      '#E4E4E7',
  textPrimary: '#FAFAFA',
  textSoft:  '#F4F4F5',
  ink:       '#FAFAFA',
  inkSoft:   '#A1A1AA',
  muted:     '#A1A1AA',
  dim:       '#8F8F96',
  slate:     '#71717A',
  teal:      C.teal,   tealMid: C.tealMid, tealLight: C.tealLight, tealDim: C.tealDim,
  coral:     C.coral,  coralLight: C.coralLight,
  amber:     C.amber,  warn: C.warn,  yellow: C.yellow,
  green:     C.green,  good: C.green,
  orange:    '#F97316',
  lime:      '#D8F24E',
  red:       C.red,    danger: C.red, offline: C.offline,
  purple:    C.purple, blue: C.blue,
  weak:      C.weak,   poor: C.poor,  routine: C.routine,
  navy:      '#0A0A0B', navyDeep: '#121214', navyCard: '#131316', navyLight: '#1A1A1E',
  sky: C.sky,   surface: C.surface,
}

export const LIGHT = {
  mode: 'light',
  bg:        '#EAF4FB',
  bgDeep:    '#FFFFFF',
  bgSoft:    '#FFFFFF',
  outer:     '#EAF4FB',
  card:      '#FFFFFF',
  cardSolid: '#FFFFFF',
  cardSoft:  '#F7F9FC',
  bar:       '#F7F9FC',
  border:    '#E9EDF3',
  line:      '#E9EDF3',
  panel:     '#FFFFFF',
  panelSoft: '#F7F9FC',
  text:      '#1E3A5F',
  textPrimary: '#0F2540',
  textSoft:  '#0F2540',
  ink:       '#0F2540',
  inkSoft:   '#5B7184',
  muted:     '#5B7184',
  dim:       '#64748B',
  slate:     '#64748B',
  teal:      '#0F766E', tealMid: '#0D9488', tealLight: '#CCFBF1', tealDim: '#134E4A',
  coral:     '#EA580C', coralLight: '#FED7AA',
  amber:     '#B45309', warn: '#B45309', yellow: '#A16207',
  green:     '#16A34A', good: '#16A34A',
  orange:    '#EA580C',
  lime:      '#D8F24E',
  red:       '#DC2626', danger: '#DC2626', offline: '#DC2626',
  purple:    '#7C3AED', blue: '#2563EB',
  weak:      '#B45309', poor: '#EA580C', routine: '#2563EB',
  navy:      '#EAF4FB', navyDeep: '#FFFFFF', navyCard: '#FFFFFF', navyLight: '#F8FAFC',
  sky: '#EAF4FB', surface: '#FFFFFF',
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