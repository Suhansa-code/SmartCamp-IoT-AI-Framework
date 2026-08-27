'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { mockAlerts } from '@/data/alerts.data'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

const NotificationsContext = createContext({
  notifications: [],
  loading: true,
  pendingCount: 0,
  escalatedCount: 0,
  resolveAlert: async () => {},
  escalateAlert: async () => {},
  refresh: async () => {},
})

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/alerts?camp=`)
      if (res.ok) {
        const data = await res.json()
        const transformed = data.alerts.map((a) => ({
          id: a.alert_id,
          childId: a.child_id?.replace(/TEST-CHILD-/, '').replace(/CHILD-/, '') ?? '—',
          campId: a.camp_id?.toLowerCase() ?? 'unknown',
          campName: a.camp_id ?? 'Unknown Camp',
          alertType: a.alert_type ?? 'Unknown Alert',
          severity:
            a.alert_type?.includes('Low') || a.alert_type?.includes('low')
              ? 'low'
              : a.alert_type?.includes('High') || a.alert_type?.includes('high')
                ? 'high'
                : 'medium',
          status: a.status === 'escalated' ? 'escalated' : a.status === 'resolved' ? 'resolved' : 'pending',
          triggeredAt: new Date(a.triggered_at).getTime(),
          scores: (a.recent_scores || []).map((score, idx) => ({ session: idx + 1, score })),
        }))
        setNotifications(transformed)
      } else {
        throw new Error('API error')
      }
    } catch {
      setNotifications(mockAlerts())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const resolveAlert = useCallback(async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Reviewed by admin' }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, status: 'resolved' } : a)),
        )
      }
    } catch (err) {
      console.error('Resolve failed:', err)
    }
  }, [])

  const escalateAlert = useCallback(async (alertId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Escalated by admin' }),
      })
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, status: 'escalated' } : a)),
        )
      }
    } catch (err) {
      console.error('Escalate failed:', err)
    }
  }, [])

  const pendingCount = useMemo(
    () => notifications.filter((a) => a.status === 'pending').length,
    [notifications],
  )

  const escalatedCount = useMemo(
    () => notifications.filter((a) => a.status === 'escalated').length,
    [notifications],
  )

  const value = useMemo(
    () => ({
      notifications,
      loading,
      pendingCount,
      escalatedCount,
      resolveAlert,
      escalateAlert,
      refresh: fetchAlerts,
    }),
    [notifications, loading, pendingCount, escalatedCount, resolveAlert, escalateAlert, fetchAlerts],
  )

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}
