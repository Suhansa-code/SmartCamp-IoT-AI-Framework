// Professional disaster-management palette — calm, trustworthy, modern.
// Design tokens + semantic color maps used across the app.

export const P = {
  outer:     'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 50%, #F1F5F9 100%)',
  panel:     '#FFFFFF',
  panelSoft: '#F8FAFC',
  card:      '#FFFFFF',
  cardSoft:  '#F8FAFC',
  ink:       '#0F172A',
  inkSoft:   '#475569',
  muted:     '#64748B',
  border:    '#E2E8F0',
  lime:      '#2563EB',
  limeDark:  '#1D4ED8',
  dark:      '#0F172A',
  red:       '#DC2626',
  amber:     '#D97706',
  green:     '#16A34A',
  purple:    '#2563EB',
  teal:      '#2563EB',
}

export const SEVERITY_COLOR = { high: P.red, medium: P.amber, low: P.green }
export const SEVERITY_RANK  = { high: 3, medium: 2, low: 1 }
export const STATUS_COLOR   = { pending: P.amber, escalated: P.purple, resolved: P.teal }

export const SEVERITY_STYLES = {
  high:   { bg: '#FEE2E2', text: '#DC2626', label: '🔴 High · ඉහළ' },
  medium: { bg: '#FEF3C7', text: '#D97706', label: '🟡 Medium · මධ්‍යම' },
  low:    { bg: '#DCFCE7', text: '#16A34A', label: '🟢 Low · පහළ' },
}
