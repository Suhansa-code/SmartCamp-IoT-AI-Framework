// lib/api.js — API call functions to Node.js backend
// Base URL follows VITE_API_URL (defaults to localhost:5000 for the unified backend)

import { API } from '@/components/ui/config'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message ?? `API error: ${res.status}`)
  }
  return res.json()
}

export async function startSession(personId) {
  return apiFetch('/api/session/start', {
    method: 'POST',
    body: JSON.stringify({ person_id: personId }),
  })
}

export async function saveLanguagePreference(childId, language) {
  return apiFetch('/api/child/language', {
    method: 'POST',
    body: JSON.stringify({ child_id: childId, language }),
  })
}

export async function fetchChildEducation(childId) {
  return apiFetch(`/api/child/${encodeURIComponent(childId)}/education`)
}

export async function fetchChildDirectory(page = 1, limit = 5) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiFetch(`/api/child/list?${query.toString()}`)
}
