'use client'

/**
 * Stock outlook — when each commodity runs out, and when to reorder.
 *
 * The inventory page answers "how much is left". This one answers "how long
 * does it last", which is a different question: the level test cannot see
 * arrivals, so 500 kg of rice reads healthy right up until a camp fills.
 *
 * Everything here comes from GET /api/resources/stock/outlook, which walks the
 * population forecast day by day against each commodity's share of the basket.
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, PackageCheck, RefreshCw, TrendingUp, CalendarClock, Info } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'
import { DISASTER_API_BASE } from "@/lib/apiBase";

const API = DISASTER_API_BASE

// Derived from the theme rather than hardcoded, so the badges follow the
// palette in both light and dark mode. The background is the accent at low
// alpha, which reads correctly on either ground.
const statusStyles = (T) => ({
  CRITICAL:  { fg: T.red,   label: 'Critical' },
  LOW:       { fg: T.amber, label: 'Low' },
  AVAILABLE: { fg: T.green, label: 'Available' },
  UNKNOWN:   { fg: T.muted, label: 'Not forecast' },
})

/** Hex accent -> low-alpha background that works on light or dark. */
function tint(hex, alpha = 0.15) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex))
  if (!m) return 'transparent'
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function Stat({ T, label, value, sub, accent }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem',
      padding: '1rem 1.1rem', flex: '1 1 170px', minWidth: 0,
    }}>
      <p style={{ fontSize: '0.68rem', fontWeight: 800, color: T.muted, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
        {label}
      </p>
      <p style={{ fontSize: '1.6rem', fontWeight: 800, color: accent || T.textPrimary, margin: '0.35rem 0 0' }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '0.74rem', color: T.dim, margin: '0.2rem 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function StockOutlookPanel() {
  const { T } = useTheme()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [days, setDays]       = useState(30)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/resources/stock/outlook?days=${days}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setData(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  if (loading && !data) {
    return <p style={{ color: T.muted, padding: '2rem' }}>Loading stock outlook…</p>
  }
  if (error) {
    return (
      <div style={{ background: tint(T.red, 0.12), border: `1px solid ${T.red}`, borderRadius: '0.9rem', padding: '1rem', color: T.red }}>
        <strong>Could not load stock outlook.</strong> {error}
      </div>
    )
  }

  const { summary, population, items, lead_time_days, provenance } = data
  const STATUS_STYLE = statusStyles(T)
  const forecastable = items.filter((i) => i.forecastable)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

      {/* Population basis — the forecast everything below depends on */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem',
        padding: '1rem 1.1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      }}>
        <TrendingUp size={18} style={{ color: T.teal, flexShrink: 0, marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, color: T.textPrimary, fontSize: '0.92rem' }}>
            {population.current} people now · {population.slope_per_day >= 0 ? '+' : ''}
            {population.slope_per_day}/day ·{' '}
            <span style={{ color: population.confidence === 'HIGH' ? T.green : population.confidence === 'MEDIUM' ? T.amber : T.red }}>
              {population.confidence} confidence
            </span>
          </p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: T.muted, lineHeight: 1.45 }}>
            {population.note}
          </p>
        </div>
      </div>

      {/* Headline counters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Stat T={T} label="Critical" value={summary.critical}
              sub={`under ${lead_time_days}d cover`} accent={summary.critical ? T.red : T.textPrimary} />
        <Stat T={T} label="Low" value={summary.low}
              sub={`under ${lead_time_days * 2}d cover`} accent={summary.low ? T.amber : T.textPrimary} />
        <Stat T={T} label="Next runout" value={fmtDate(summary.next_runout)}
              sub={summary.next_runout ? 'earliest across all items' : 'none within horizon'} />
        <Stat T={T} label="Tracked" value={`${summary.forecastable}/${summary.total_items}`}
              sub="items with a daily draw rate" />
      </div>

      {/* Horizon control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', color: T.muted, fontWeight: 700 }}>Horizon</span>
        {[14, 30, 60].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '0.35rem 0.8rem', borderRadius: '9999px', cursor: 'pointer',
            border: `1px solid ${days === d ? T.teal : T.border}`,
            background: days === d ? T.tealLight : T.card,
            color: days === d ? T.tealDim : T.muted, fontWeight: 700, fontSize: '0.78rem',
          }}>{d} days</button>
        ))}
        <button onClick={load} disabled={loading} style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '0.35rem 0.8rem', borderRadius: '9999px', border: `1px solid ${T.border}`,
          background: T.card, color: T.muted, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
        }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Item table */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: '0.9rem', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: 780 }}>
            <thead>
              <tr style={{ background: T.bar }}>
                {['Resource', 'Status', 'In stock', 'Use / day', 'Cover', 'Runs out', 'Order by', 'Suggested order'].map((h) => (
                  <th key={h} style={{
                    textAlign: h === 'Resource' || h === 'Status' ? 'left' : 'right',
                    padding: '0.7rem 0.9rem', fontSize: '0.68rem', fontWeight: 800,
                    color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const st = STATUS_STYLE[it.status] || STATUS_STYLE.UNKNOWN
                return (
                  <tr key={it.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ padding: '0.7rem 0.9rem', fontWeight: 700, color: T.textPrimary }}>
                      {it.resource_name}
                      {it.commodity_matched && it.commodity_matched !== it.resource_name && (
                        <span style={{ display: 'block', fontSize: '0.7rem', color: T.dim, fontWeight: 500 }}>
                          matched: {it.commodity_matched}
                        </span>
                      )}
                      {it.warnings?.length > 0 && (
                        <span title={it.warnings.join(' ')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                          fontSize: '0.68rem', color: T.amber, fontWeight: 700,
                        }}>
                          <AlertTriangle size={11} /> {it.warnings.length} warning{it.warnings.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem' }}>
                      <span style={{
                        background: tint(st.fg), color: st.fg, borderRadius: '9999px',
                        padding: '2px 10px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap',
                      }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: T.ink }}>
                      {it.available_quantity} {it.unit}
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: T.ink }}>
                      {it.daily_use_now ?? '—'}
                    </td>
                    <td style={{
                      padding: '0.7rem 0.9rem', textAlign: 'right', fontWeight: 800,
                      color: it.status === 'CRITICAL' ? T.red : it.status === 'LOW' ? T.amber : T.ink,
                    }}>
                      {it.days_cover ?? '—'}{it.days_cover != null && ' d'}
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: T.ink, whiteSpace: 'nowrap' }}>
                      {fmtDate(it.runout_date)}
                      {it.runout_earliest && it.runout_latest && it.runout_earliest !== it.runout_latest && (
                        <span style={{ display: 'block', fontSize: '0.68rem', color: T.dim }}>
                          {fmtDate(it.runout_earliest)} – {fmtDate(it.runout_latest)}
                        </span>
                      )}
                    </td>
                    <td style={{
                      padding: '0.7rem 0.9rem', textAlign: 'right', whiteSpace: 'nowrap',
                      fontWeight: it.status === 'CRITICAL' ? 800 : 600,
                      color: it.status === 'CRITICAL' ? T.red : T.ink,
                    }}>
                      {fmtDate(it.reorder_by)}
                    </td>
                    <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: T.ink }}>
                      {it.suggested_order_qty != null ? `${it.suggested_order_qty} ${it.unit}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {forecastable.length === 0 && (
          <p style={{ padding: '1.2rem', color: T.muted, margin: 0, fontSize: '0.85rem' }}>
            No items have a daily consumption rate, so no runout dates can be projected.
            Give resources a FOOD or WATER category to include them.
          </p>
        )}
      </div>

      {/* Provenance — what these numbers rest on */}
      <div style={{
        background: T.cardSoft, border: `1px solid ${T.border}`, borderRadius: '0.9rem',
        padding: '0.9rem 1.1rem', display: 'flex', gap: '0.7rem', alignItems: 'flex-start',
      }}>
        <Info size={16} style={{ color: T.muted, flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.76rem', color: T.muted, lineHeight: 1.55 }}>
          <strong style={{ color: T.textPrimary }}>How these dates are produced.</strong>{' '}
          Population is forecast from live check-in history ({provenance.population}); food
          quantities come from {provenance.food_rates}; water from {provenance.water_rates}; each
          commodity&apos;s share of the basket is measured from {provenance.commodity_shares}.
          Reorder dates assume a {lead_time_days}-day resupply lead time.
          {provenance.basis_note && (
            <span style={{ display: 'block', marginTop: '0.4rem' }}>
              <strong style={{ color: T.textPrimary }}>Basis:</strong> {provenance.basis_note}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
