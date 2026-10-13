'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import SideNav from '@/components/common/SideNav'
import PageHeader, { HeaderShell } from '@/components/common/PageHeader'
import PageTitle from '@/components/common/PageTitle'
import { useTheme } from '@/components/common/ThemeProvider'
import { API_BASE } from '@/lib/apiBase'

const priorities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function priorityStyle(T, priority) {
  const color = {
    CRITICAL: T.danger,
    HIGH: T.warn,
    MEDIUM: T.blue,
    LOW: T.muted,
  }[priority] || T.muted
  return { color, border: `${color}55`, background: `${color}14` }
}

function formatDate(value) {
  if (!value) return 'Unknown time'
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function SyncPage() {
  const { T } = useTheme()
  const [events, setEvents] = useState([])
  const [networkStatuses, setNetworkStatuses] = useState([])
  const [priority, setPriority] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = priority === 'ALL' ? '' : `&priority=${priority}`
      const [eventsResponse, networkResponse] = await Promise.all([
        fetch(`${API_BASE}/api/sync/events?limit=100${query}`),
        fetch(`${API_BASE}/api/sync/network-status`),
      ])
      if (!eventsResponse.ok || !networkResponse.ok) throw new Error(`Request failed (${eventsResponse.status}/${networkResponse.status})`)
      const [body, networkBody] = await Promise.all([eventsResponse.json(), networkResponse.json()])
      setEvents(body.data || [])
      setNetworkStatuses(networkBody.data || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [priority])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ minHeight: '100svh', background: T.outer, color: T.ink, paddingLeft: 'var(--rail-width, 236px)', fontFamily: "'Inter',sans-serif" }}>
      <SideNav />
      <div className="header-wrapper">
        <main style={{ minHeight: '100svh', background: T.panel }}>
          <HeaderShell><PageHeader /></HeaderShell>
          <div style={{ padding: '0 2rem 2rem', maxWidth: 1320, margin: '0 auto' }}>
            <PageTitle eyebrow="Operations" title="Cloud Sync" subtitle="Priority-tagged messages received from Raspberry Pi devices" />
            {networkStatuses.length > 0 && <section style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
              {networkStatuses.map((status) => {
                const tone = priorityStyle(T, status.state === 'CRITICAL' ? 'CRITICAL' : status.state === 'DEGRADED' ? 'HIGH' : 'LOW')
                return <article key={status.device_id} style={{ background: T.card, border: `1px solid ${tone.border}`, borderRadius: 12, padding: '0.9rem 1rem' }}>
                  <div style={{ color: T.muted, fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em' }}>{status.camp_id || status.device_id}</div>
                  <div style={{ color: tone.color, fontSize: '1.15rem', fontWeight: 800, marginTop: 5 }}>{status.state}</div>
                  <div style={{ color: T.muted, fontSize: '0.76rem', marginTop: 7 }}>RTT {status.metrics?.rtt_avg ?? '—'} ms · Loss {status.metrics?.packet_loss ?? '—'}%</div>
                  <div style={{ color: T.muted, fontSize: '0.72rem', marginTop: 4 }}>{formatDate(status.observed_at)}</div>
                </article>
              })}
            </section>}
            <section style={{ marginTop: '1.25rem', background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '1rem 1.1rem', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} style={{ background: T.panel, color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0.5rem 0.65rem', fontWeight: 700 }}>
                  {priorities.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All priorities' : item}</option>)}
                </select>
                <button onClick={load} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: `1px solid ${T.border}`, borderRadius: 8, padding: '0.5rem 0.7rem', background: T.panel, color: T.textPrimary, fontWeight: 700, cursor: loading ? 'wait' : 'pointer' }}>
                  <RefreshCw size={15} className={loading ? 'sync-spin' : ''} /> Refresh
                </button>
              </div>
              {error && <p style={{ margin: 0, padding: '1rem', color: T.danger }}>Could not load cloud sync events: {error}</p>}
              {!error && loading && <p style={{ margin: 0, padding: '1rem', color: T.muted }}>Loading messages...</p>}
              {!error && !loading && events.length === 0 && <p style={{ margin: 0, padding: '1rem', color: T.muted }}>No synced messages match this filter.</p>}
              {!error && !loading && events.map((event) => {
                const badge = priorityStyle(T, event.priority)
                return <div key={event.sync_id} style={{ padding: '0.85rem 1.1rem', borderTop: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'auto minmax(150px, 1fr) minmax(100px, auto) minmax(120px, auto)', gap: 14, alignItems: 'center' }}>
                  <span style={{ ...badge, border: `1px solid ${badge.border}`, borderRadius: 999, padding: '0.23rem 0.5rem', fontSize: '0.67rem', fontWeight: 800, letterSpacing: '0.06em' }}>{event.priority}</span>
                  <div><strong style={{ color: T.textPrimary }}>{event.entity}</strong><div style={{ color: T.muted, fontSize: '0.78rem', marginTop: 3 }}>Record {event.local_id}{event.camp_id ? ` · ${event.camp_id}` : ''}</div></div>
                  <span style={{ color: T.muted, fontSize: '0.78rem', textAlign: 'right' }}>{event.operation}</span>
                  <time style={{ color: T.muted, fontSize: '0.78rem', textAlign: 'right' }}>{formatDate(event.received_at)}</time>
                </div>
              })}
            </section>
          </div>
        </main>
      </div>
      <style>{`@keyframes sync-spin { to { transform: rotate(360deg); } } .sync-spin { animation: sync-spin 0.8s linear infinite; } @media (max-width: 700px) { section div[style*="grid-template-columns"] { grid-template-columns: auto 1fr !important; } }`}</style>
    </div>
  )
}
