// "nitec"-style palette — white theme, independent of app theme.
// Design tokens + semantic color maps used across the app.

export const P = {
  outer:     'linear-gradient(135deg, #FFFFFF 0%, #F6F8FB 50%, #EDF1F7 100%)',
  panel:     '#FFFFFF',
  panelSoft: '#F8FAFD',
  card:      '#FFFFFF',
  cardSoft:  '#F7F9FC',
  ink:       '#0F172A',
  inkSoft:   '#334155',
  muted:     '#64748B',
  border:    '#E9EDF3',
  lime:      '#D8F24E',
  limeDark:  '#B9DD2E',
  dark:      '#0F172A',
  red:       '#EF4444',
  amber:     '#F59E0B',
  green:     '#22C55E',
  purple:    '#8B5CF6',
  teal:      '#0D9488',
}

export const SEVERITY_COLOR = { high: P.red, medium: P.amber, low: P.green }
export const SEVERITY_RANK  = { high: 3, medium: 2, low: 1 }
export const STATUS_COLOR   = { pending: P.amber, escalated: P.purple, resolved: P.teal }

export const SEVERITY_STYLES = {
  high:   { bg: '#FEE2E2', text: '#DC2626', label: '🔴 High · ඉහළ' },
  medium: { bg: '#FEF3C7', text: '#D97706', label: '🟡 Medium · මධ්‍යම' },
  low:    { bg: '#DCFCE7', text: '#16A34A', label: '🟢 Low · පහළ' },
}