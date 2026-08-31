export const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

export const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  DEGRADED: { badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500', text: 'text-amber-700' },
  CRITICAL: { badge: 'bg-red-50 text-red-700', dot: 'bg-red-500', text: 'text-red-700' },
  UNKNOWN:  { badge: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400', text: 'text-gray-500' },
}

export const NETWORK_STATE_DESC = {
  STABLE:   'Network healthy — full QoS 2 for critical messages',
  DEGRADED: 'Network congested — QoS automatically upgraded to protect delivery',
  CRITICAL: 'Network failing — critical messages downgraded to QoS 1, others buffered',
  UNKNOWN:  'Waiting for first ML prediction…',
}

export const inputClass =
  "w-full px-3 py-2 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm text-ink border border-line"

export const inputClassAlt =
  "w-full px-3.5 py-2.5 bg-grid rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm text-ink border border-line placeholder-muted"
