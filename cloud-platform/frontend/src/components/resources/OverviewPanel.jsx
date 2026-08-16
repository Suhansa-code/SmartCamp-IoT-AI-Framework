'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '@/components/common/ThemeProvider'
import { timeAgo } from '@/components/common/utils'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── helpers ──────────────────────────────────────────────────────────────────

function networkColor(T, state) {
  if (state === 'STABLE')       return T.green
  if (state === 'DEGRADED')     return T.warn
  return T.danger
}

function confidenceColor(T, c) {
  if (c === 'HIGH')   return T.green
  if (c === 'MEDIUM') return T.warn
  return T.slate
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color, sub }) {
  const { T } = useTheme()
  return (
    <div style={{
      background: T.cardSolid, border: `1px solid ${T.line}`,
      borderRadius: 12, padding: '14px 18px', flex: '1 1 130px',
      display: 'flex', flexDirection: 'column', gap: 2,
      boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, fontFamily: "'Inter',sans-serif", lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 11, color: T.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.slate, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function DistBar({ icon, label, served, pending, percent }) {
  const { T } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <div style={{ width: 80, fontSize: 12, fontWeight: 700, color: T.text }}>{label}</div>
      <div style={{ flex: 1, background: T.bar, borderRadius: 99, height: 10, overflow: 'hidden' }}>
        <div style={{
          width: `${percent}%`, height: '100%', borderRadius: 99,
          background: percent === 100 ? T.green : percent > 60 ? T.teal : T.warn,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 800, color: T.text }}>
        {percent}%
      </div>
      <div style={{ width: 60, fontSize: 11, color: T.slate }}>
        {served}/{served + pending}
      </div>
    </div>
  )
}

function PredictionRow({ icon, label, value, unit }) {
  const { T } = useTheme()
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', background: T.bgSoft, borderRadius: 8,
      border: `1px solid ${T.line}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{label}</span>
      </div>
      <div>
        <span style={{ fontSize: 22, fontWeight: 900, color: T.tealMid, fontFamily: "'Inter',sans-serif" }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: T.dim, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}

function EventRow({ event }) {
  const { T } = useTheme()
  const meta = { registration: { dot: T.green, icon: '🆕' }, checkin: { dot: T.blue, icon: '✓' }, distribution: { dot: T.teal, icon: '🍽️' } }[event.type] || { dot: T.slate, icon: '·' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 12px', borderRadius: 7,
      background: T.bgSoft, border: `1px solid ${T.line}`,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: meta.dot, boxShadow: `0 0 5px ${meta.dot}`,
      }} />
      <span style={{ fontSize: 14, flexShrink: 0 }}>{meta.icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: T.text,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {event.summary}
      </span>
      <span style={{ fontSize: 11, color: T.slate, flexShrink: 0 }}>{timeAgo(event.timestamp)}</span>
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────

export default function OverviewPanel() {
  const { T } = useTheme()
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [,           setTick]       = useState(0)

  const fetchStats = useCallback(async () => {
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
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, 30_000)
    return () => clearInterval(id)
  }, [fetchStats])

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  // ── loading / error ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.slate }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
        <div>Connecting to EMQX data stream…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: T.danger }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
        <div style={{ fontWeight: 700 }}>{error}</div>
        <div style={{ fontSize: 12, color: T.slate, marginTop: 6 }}>
          Make sure the cloud backend is running on port 3001
        </div>
        <button onClick={fetchStats} style={{
          marginTop: 16, padding: '8px 20px', borderRadius: 8,
          background: T.teal, border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer',
        }}>Retry</button>
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

  return (
    <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── header ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 900, fontSize: '1.1rem', color: T.text }}>
          Camp Overview
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: networkColor(T, mqtt.network_state),
            boxShadow: `0 0 6px ${networkColor(T, mqtt.network_state)}`,
          }} />
          <span style={{ fontSize: 11, color: T.dim }}>
            {mqtt.network_state} · updated {lastUpdate ? timeAgo(new Date(lastUpdate)) : '—'}
          </span>
          <button onClick={fetchStats} style={{
            background: 'transparent', border: `1px solid ${T.line}`,
            borderRadius: 6, color: T.dim, cursor: 'pointer', fontSize: 11, padding: '2px 8px',
          }}>↻</button>
        </div>
      </div>

      {/* ── stat cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatCard icon="👥" value={population.total}
          label="Registered" color={T.tealMid}
          sub={`${population.families} families`} />
        <StatCard icon="🆕" value={population.today_registered}
          label="Today New" color={T.blue}
          sub={`${population.today_checkins} check-ins`} />
        <StatCard icon="📊" value={`${population.attendance_rate_pct ?? 0}%`}
          label="Attendance" color={population.attendance_rate_pct > 70 ? T.green : T.warn}
          sub={`${population.today_checkins} of ${population.total} present`} />
        <StatCard icon="🍽️" value={`${overallPct}%`}
          label="Fed Today" color={overallPct > 80 ? T.green : T.warn}
          sub={`${servedAny} of ${totalSlots} servings`} />
        <StatCard icon="⚠️" value={vulnerable.total_flagged}
          label="Need Attention" color={vulnerable.total_flagged > 0 ? T.warn : T.green}
          sub={`${vulnerable.pregnant} pregnant · ${vulnerable.chronic_illness} chronic`} />
        <StatCard icon="📡" value={mqtt.buffered_messages}
          label="MQTT Buffered" color={mqtt.buffered_messages > 0 ? T.warn : T.green}
          sub={mqtt.network_state} />
      </div>

      {/* ── distribution progress ─────────────────────────────────────── */}
      <div style={{ background: T.cardSolid, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 6px 18px rgba(0,0,0,0.14)' }}>
        <div style={{ fontSize: 11, color: T.dim, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 1, marginBottom: 10 }}>
          Today's Distribution
          <span style={{ color: T.slate, fontWeight: 400 }}> · {eligible_for_distribution} eligible</span>
        </div>
        <DistBar icon="☕" label="Breakfast" {...distribution_today.breakfast} />
        <DistBar icon="🍛" label="Lunch"     {...distribution_today.lunch} />
        <DistBar icon="🍲" label="Dinner"    {...distribution_today.dinner} />
        <DistBar icon="💧" label="Water"     {...distribution_today.water} />
      </div>

      {/* ── prediction ───────────────────────────────────────────────── */}
      <div style={{ background: T.cardSolid, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 6px 18px rgba(0,0,0,0.14)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Tomorrow's Resource Prediction
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 99,
              background: T.bgSoft, border: `1px solid ${confidenceColor(T, prediction_tomorrow.confidence)}`,
              color: confidenceColor(T, prediction_tomorrow.confidence),
            }}>
              {prediction_tomorrow.confidence} · {prediction_tomorrow.days_of_data}d data
            </span>
            <span style={{
              fontSize: 11, background: T.bgSoft, border: `1px solid ${T.line}`,
              borderRadius: 6, padding: '3px 10px', color: T.tealMid, fontWeight: 700,
            }}>
              {prediction_tomorrow.expected_persons} people · {prediction_tomorrow.attendance_rate_pct}% attendance
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Expected new arrivals', value: `+${prediction_tomorrow.expected_new_arrivals}` },
          ].map(s => (
            <div key={s.label} style={{
              background: T.bgSoft, border: `1px solid ${T.line}`, borderRadius: 6,
              padding: '4px 12px', fontSize: 11, color: T.dim,
            }}>
              {s.label}: <span style={{ color: T.blue, fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PredictionRow icon="☕" label="Breakfast"  value={prediction_tomorrow.breakfast_kg}  unit="kg" />
          <PredictionRow icon="🍛" label="Lunch"      value={prediction_tomorrow.lunch_kg}      unit="kg" />
          <PredictionRow icon="🍲" label="Dinner"     value={prediction_tomorrow.dinner_kg}     unit="kg" />
          <PredictionRow icon="💧" label="Water"      value={prediction_tomorrow.water_litres}  unit="litres" />
        </div>

        {prediction_tomorrow.note && (
          <div style={{ marginTop: 10, fontSize: 11, color: T.warn, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>ℹ️</span> {prediction_tomorrow.note}
          </div>
        )}
      </div>

      {/* two-column: event feed + recent registrations */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>

        {/* ── live event feed ───────────────────────────────────── */}
        <div style={{ flex: '1 1 340px', background: T.cardSolid, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 6px 18px rgba(0,0,0,0.14)' }}>
          <div style={{ fontSize: 11, color: T.dim, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 10 }}>
            📡 Live EMQX Events
          </div>
          {!recent_events || recent_events.length === 0 ? (
            <div style={{ fontSize: 13, color: T.slate, textAlign: 'center', padding: '1rem 0' }}>
              Waiting for events from the camp…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recent_events.slice(0, 10).map((ev, i) => <EventRow key={i} event={ev} />)}
            </div>
          )}
        </div>

        {/* ── recent registrations ──────────────────────────────── */}
        <div style={{ flex: '1 1 340px', background: T.cardSolid, border: `1px solid ${T.line}`, borderRadius: 12, padding: '14px 18px', boxShadow: '0 6px 18px rgba(0,0,0,0.14)' }}>
          <div style={{ fontSize: 11, color: T.dim, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 10 }}>
            Recent Registrations
          </div>
          {recent_registrations.length === 0 ? (
            <div style={{ fontSize: 13, color: T.slate, textAlign: 'center', padding: '1rem 0' }}>
              No registrations yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent_registrations.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: T.bgSoft,
                  borderRadius: 8, border: `1px solid ${T.line}`,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: p.is_pregnant ? T.purple : p.has_chronic_illness ? T.amber : T.tealDim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 900, color: 'white',
                  }}>
                    {p.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.full_name}
                    </div>
                    <div style={{ fontSize: 11, color: T.slate }}>
                      {p.wristband_barcode ?? 'No wristband'} · {p.age}y {p.gender}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.is_pregnant         && <span title="Pregnant"        style={flagStyle(T, T.purple)}>🤰</span>}
                    {p.has_chronic_illness && <span title="Chronic illness"  style={flagStyle(T, T.amber)}>💊</span>}
                    {p.pre_registered
                      ? <span style={flagStyle(T, T.tealDim)} title="Pre-registered">✓</span>
                      : <span style={flagStyle(T, T.border)} title="New arrival">🆕</span>}
                  </div>
                  <div style={{ fontSize: 11, color: T.slate, flexShrink: 0 }}>
                    {timeAgo(p.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

const flagStyle = (T, bg) => ({
  background: bg, borderRadius: 4, padding: '1px 5px', fontSize: 12,
})