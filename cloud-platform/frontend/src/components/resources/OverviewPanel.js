'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/common/Button'
import DashboardCard from '@/components/dashboard/DashboardCard'
import { useTheme } from '@/components/common/ThemeProvider'
import { timeAgo } from '@/components/common/utils'
import { API_BASE } from "@/lib/apiBase";

const API = API_BASE

const BLUE = '#2563EB'

// ── helpers ──────────────────────────────────────────────────────────────────

function networkColor(T, state) {
  if (state === 'STABLE')       return T.green
  if (state === 'DEGRADED')     return T.amber
  return T.red
}

function confidenceColor(T, c) {
  if (c === 'HIGH')   return T.green
  if (c === 'MEDIUM') return T.amber
  return T.muted
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, sub, T }) {
  return (
    <div style={{
      flex: '1 1 180px', minWidth: 168,
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: '1.25rem', padding: '1rem 1.1rem',
      display: 'flex', flexDirection: 'column', gap: 7,
      boxShadow: '0 14px 34px rgba(20,30,40,0.06)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 12, flexShrink: 0,
        background: `${color}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color, fontFamily: "'Inter',sans-serif", lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: '0.66rem', color: T.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600, marginTop: -2 }}>{sub}</div>}
    </div>
  )
}

function DistBar({ icon, label, served, pending, percent, T }) {
  const fill = percent === 100 ? T.green : percent > 60 ? T.teal : T.amber
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{
        width: 30, height: 30, borderRadius: 10, flexShrink: 0,
        background: `${fill}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
      }}>
        {icon}
      </span>
      <div style={{ width: 84, fontSize: '0.78rem', fontWeight: 700, color: T.ink }}>{label}</div>
      <div style={{ flex: 1, background: T.cardSoft, borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{
          width: `${percent}%`, height: '100%', borderRadius: 99, background: fill,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ width: 42, textAlign: 'right', fontSize: '0.82rem', fontWeight: 800, color: T.ink }}>
        {percent}%
      </div>
      <div style={{ width: 64, fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>
        {served}/{served + pending}
      </div>
    </div>
  )
}

function PredictionRow({ icon, label, value, unit, T }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: T.panelSoft, borderRadius: 12, border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 10, flexShrink: 0,
          background: `${T.teal}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>
          {icon}
        </span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink }}>{label}</span>
      </div>
      <div>
        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: T.teal, fontFamily: "'Inter',sans-serif" }}>
          {value}
        </span>
        <span style={{ fontSize: '0.75rem', color: T.muted, marginLeft: 4, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  )
}

function EventRow({ event, T }) {
  const meta = {
    registration:  { dot: T.green,  icon: '🆕' },
    checkin:       { dot: BLUE,     icon: '✓' },
    distribution:  { dot: T.teal,   icon: '🍽️' },
  }[event.type] || { dot: T.muted, icon: '·' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 12px', borderRadius: 10,
      background: T.panelSoft, border: `1px solid ${T.border}`,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: meta.dot, boxShadow: `0 0 5px ${meta.dot}`,
      }} />
      <span style={{ fontSize: 13, flexShrink: 0 }}>{meta.icon}</span>
      <span style={{
        flex: 1, fontSize: '0.76rem', color: T.ink, fontWeight: 600,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {event.summary}
      </span>
      <span style={{ fontSize: '0.7rem', color: T.muted, flexShrink: 0, fontWeight: 600 }}>{timeAgo(event.timestamp)}</span>
    </div>
  )
}

function flagStyle(bg) {
  return { background: bg, borderRadius: 4, padding: '1px 5px', fontSize: 12 }
}

// ── main component ─────────────────────────────────────────────────────────────

export default function OverviewPanel({ search = '', refreshKey = 0, onLoading }) {
  const { T } = useTheme()
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [,           setTick]       = useState(0)

  const fetchStats = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`${API}/api/resources/overview`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setLastUpdate(Date.now())
      setError(null)
    } catch {
      setError('Cannot reach cloud backend on port 3001')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 30_000)
    return () => clearInterval(id)
  }, [fetchStats])

  useEffect(() => {
    if (refreshKey) fetchStats({ refresh: true })
  }, [refreshKey, fetchStats])

  useEffect(() => {
    onLoading?.(refreshing || loading)
  }, [refreshing, loading, onLoading])

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // ── loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: T.muted }}>
        <div style={{ fontSize: 30, marginBottom: 10, animation: 'resPulse 1.6s ease-in-out infinite' }}>⏳</div>
        <div style={{ fontSize: '0.86rem', fontWeight: 700 }}>Connecting to EMQX data stream…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: T.muted }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: T.red }}>{error}</div>
        <div style={{ fontSize: '0.78rem', marginTop: 6 }}>
          Make sure the cloud backend is running on port 3001
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <Button onClick={fetchStats}>Retry</Button>
        </div>
      </div>
    )
  }

  const {
    population, vulnerable, distribution_today, eligible_for_distribution,
    prediction_tomorrow, mqtt, recent_registrations, recent_events,
  } = data

  const servedAny   = Object.values(distribution_today).reduce((s, d) => s + d.served, 0)
  const totalSlots  = eligible_for_distribution * 4
  const overallPct  = totalSlots > 0 ? Math.round((servedAny / totalSlots) * 100) : 0

  const q = search.trim().toLowerCase()
  const matches = (s) => !q || String(s ?? '').toLowerCase().includes(q)
  const filteredEvents = (recent_events || []).filter((e) => matches(e.summary) || matches(e.type))
  const filteredRegistrations = recent_registrations.filter((p) => matches(p.full_name) || matches(p.wristband_barcode) || matches(p.age))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

      {/* ── network meta strip (no section title) ─────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: networkColor(T, mqtt.network_state),
          boxShadow: `0 0 6px ${networkColor(T, mqtt.network_state)}`,
        }} />
        <span style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 700 }}>
          {mqtt.network_state} · updated {lastUpdate ? timeAgo(new Date(lastUpdate)) : '—'}
        </span>
      </div>

      {/* ── stat cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatCard icon="👥" value={population.total}
          label="Registered" color={T.teal}
          sub={`${population.families} families`} T={T} />
        <StatCard icon="🆕" value={population.today_registered}
          label="Today New" color={BLUE}
          sub={`${population.today_checkins} check-ins`} T={T} />
        <StatCard icon="📊" value={`${population.attendance_rate_pct ?? 0}%`}
          label="Attendance" color={population.attendance_rate_pct > 70 ? T.green : T.amber}
          sub={`${population.today_checkins} of ${population.total} present`} T={T} />
        <StatCard icon="🍽️" value={`${overallPct}%`}
          label="Fed Today" color={overallPct > 80 ? T.green : T.amber}
          sub={`${servedAny} of ${totalSlots} servings`} T={T} />
        <StatCard icon="⚠️" value={vulnerable.total_flagged}
          label="Need Attention" color={vulnerable.total_flagged > 0 ? T.amber : T.green}
          sub={`${vulnerable.pregnant} pregnant · ${vulnerable.chronic_illness} chronic`} T={T} />
        <StatCard icon="📡" value={mqtt.buffered_messages}
          label="MQTT Buffered" color={mqtt.buffered_messages > 0 ? T.amber : T.green}
          sub={mqtt.network_state} T={T} />
      </div>

      {/* ── distribution + prediction ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>

        <DashboardCard
          title="Today's Distribution"
          subtitle={`${eligible_for_distribution} people eligible`}
          right={
            <span style={{ fontSize: '0.68rem', fontWeight: 800, color: overallPct > 80 ? T.green : T.amber, background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '3px 10px' }}>
              {overallPct}% served
            </span>
          }
          style={{ flex: '1 1 320px' }}
          bodyStyle={{ gap: '0.9rem' }}
        >
          <DistBar icon="☕" label="Breakfast" {...distribution_today.breakfast} T={T} />
          <DistBar icon="🍛" label="Lunch"     {...distribution_today.lunch} T={T} />
          <DistBar icon="🍲" label="Dinner"    {...distribution_today.dinner} T={T} />
          <DistBar icon="💧" label="Water"     {...distribution_today.water} T={T} />
        </DashboardCard>

        <DashboardCard
          title="Tomorrow's Resource Prediction"
          subtitle={`${prediction_tomorrow.expected_persons} people · ${prediction_tomorrow.attendance_rate_pct}% attendance expected`}
          right={
            <span style={{
              fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: 999,
              background: T.cardSoft, border: `1px solid ${confidenceColor(T, prediction_tomorrow.confidence)}`,
              color: confidenceColor(T, prediction_tomorrow.confidence),
            }}>
              {prediction_tomorrow.confidence} · {prediction_tomorrow.days_of_data}d data
            </span>
          }
          style={{ flex: '1 1 360px' }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.ink, background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '4px 12px' }}>
              Expected new arrivals: <span style={{ color: BLUE, fontWeight: 800 }}>+{prediction_tomorrow.expected_new_arrivals}</span>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <PredictionRow icon="☕" label="Breakfast" value={prediction_tomorrow.breakfast_kg}  unit="kg" T={T} />
            <PredictionRow icon="🍛" label="Lunch"     value={prediction_tomorrow.lunch_kg}      unit="kg" T={T} />
            <PredictionRow icon="🍲" label="Dinner"    value={prediction_tomorrow.dinner_kg}     unit="kg" T={T} />
            <PredictionRow icon="💧" label="Water"     value={prediction_tomorrow.water_litres}  unit="litres" T={T} />
          </div>
          {prediction_tomorrow.note && (
            <div style={{ fontSize: '0.74rem', color: T.amber, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>ℹ️</span> {prediction_tomorrow.note}
            </div>
          )}
        </DashboardCard>
      </div>

      {/* ── live events + recent registrations ───────────────────────── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>

        <DashboardCard
          title="Live EMQX Events"
          subtitle="Inbound stream from camp MQTT broker"
          right={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.68rem', fontWeight: 800, color: T.green, background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: '3px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, boxShadow: `0 0 6px ${T.green}`, animation: 'resPulse 2s infinite' }} />
              Live
            </span>
          }
          style={{ flex: '1 1 340px' }}
          bodyStyle={{ gap: '0.55rem' }}
        >
          {!recent_events || filteredEvents.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: T.muted, textAlign: 'center', padding: '1rem 0', fontWeight: 600 }}>
              {q ? 'No matching events' : 'Waiting for events from the camp…'}
            </div>
          ) : (
            filteredEvents.slice(0, 10).map((ev, i) => <EventRow key={i} event={ev} T={T} />)
          )}
        </DashboardCard>

        <DashboardCard
          title="Recent Registrations"
          subtitle="New arrivals scanned at the camp"
          style={{ flex: '1 1 340px' }}
          bodyStyle={{ gap: '0.6rem' }}
        >
          {filteredRegistrations.length === 0 ? (
            <div style={{ fontSize: '0.8rem', color: T.muted, textAlign: 'center', padding: '1rem 0', fontWeight: 600 }}>
              {q ? 'No matching registrations' : 'No registrations yet'}
            </div>
          ) : (
            filteredRegistrations.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', background: T.panelSoft,
                borderRadius: 10, border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  background: p.is_pregnant ? T.purple : p.has_chronic_illness ? T.amber : T.teal,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 900, color: 'white',
                }}>
                  {p.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.ink,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.full_name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600 }}>
                    {p.wristband_barcode ?? 'No wristband'} · {p.age}y {p.gender}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {p.is_pregnant         && <span title="Pregnant"        style={flagStyle(T.purple)}>🤰</span>}
                  {p.has_chronic_illness && <span title="Chronic illness"  style={flagStyle(T.amber)}>💊</span>}
                  {p.pre_registered
                    ? <span style={flagStyle(T.teal)} title="Pre-registered">✓</span>
                    : <span style={flagStyle(T.border)} title="New arrival">🆕</span>}
                </div>
                <div style={{ fontSize: '0.7rem', color: T.muted, flexShrink: 0, fontWeight: 600 }}>
                  {timeAgo(p.created_at)}
                </div>
              </div>
            ))
          )}
        </DashboardCard>
      </div>
    </div>
  )
}