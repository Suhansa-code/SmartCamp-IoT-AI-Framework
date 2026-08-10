export const API = import.meta.env.VITE_API_URL || "http://localhost:5000"

export const NETWORK_STYLE = {
  STABLE:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500', border: 'border-emerald-200', text: 'text-emerald-700' },
  DEGRADED: { badge: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500', border: 'border-amber-200', text: 'text-amber-700' },
  CRITICAL: { badge: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500', border: 'border-red-200', text: 'text-red-700' },
  UNKNOWN:  { badge: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', border: 'border-slate-200', text: 'text-slate-500' },
}

export const NETWORK_STATE_DESC = {
  STABLE:   'Network healthy — full QoS 2 for critical messages',
  DEGRADED: 'Network congested — QoS automatically upgraded to protect delivery',
  CRITICAL: 'Network failing — critical messages downgraded to QoS 1, others buffered',
  UNKNOWN:  'Waiting for first ML prediction…',
}

export const inputClass =
  "w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800"

export const inputClassAlt =
  "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800 placeholder-slate-400"
