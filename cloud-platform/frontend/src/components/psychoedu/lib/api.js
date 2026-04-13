// lib/api.js — API call functions to Node.js backend
// All calls go to /api/* (Next.js route handlers proxy to Node.js)
// Includes offline-safe wrappers with fallback behaviour

const BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.REACT_APP_API_BASE_URL ??
  'http://localhost:3001'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? 'API error')
  }
  return res.json()
}

//Session 
export async function startSession(childId) {
  return apiFetch('/api/session/start', {
    method: 'POST',
    body: JSON.stringify({ child_id: childId }),
  })
}

export async function submitScore(payload) {
  // payload: { sessionId, score, totalTrials, results }
  return apiFetch('/api/session/score', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// Volunteer 
export async function volunteerLogin(pin) {
  return apiFetch('/api/volunteer/login', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}

export async function fetchVolunteerSessions() {
  return apiFetch('/api/volunteer/sessions')
}

export async function fetchVolunteerAlerts() {
  return apiFetch('/api/volunteer/alerts')
}

// Admin 
export async function fetchAllCamps() {
  return apiFetch('/api/admin/camps')
}

export async function fetchAdminAlerts(campId) {
  const qs = campId ? `?camp=${campId}` : ''
  return apiFetch(`/api/admin/alerts${qs}`)
}

export async function fetchAnalytics() {
  return apiFetch('/api/admin/analytics')
}

export async function actionAlert(alertId, action) {
  // action: 'acknowledge' | 'escalate' | 'resolve'
  return apiFetch(`/api/alerts/${alertId}/${action}`, { method: 'POST' })
}

// ── Network Monitoring ──────────────────────────────────────
export async function fetchNetworkMetrics() {
  return apiFetch('/api/network/metrics')
}

export async function fetchNetworkStats() {
  return apiFetch('/api/network/stats')
}

export async function fetchNetworkBuffer() {
  return apiFetch('/api/network/buffer')
}

export async function fetchNetworkHistory(limit = 100) {
  return apiFetch(`/api/network/history?limit=${limit}`)
}

export async function clearNetworkBuffer() {
  return apiFetch('/api/network/clear-buffer', { method: 'POST' })
}
