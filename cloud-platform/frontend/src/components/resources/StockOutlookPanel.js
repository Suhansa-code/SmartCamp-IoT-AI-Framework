'use client'

/**
 * Stock outlook — what is running out, when, and what to order.
 *
 * The inventory page answers "how much is left". This one answers "how long
 * does it last", which is a different question: a level test cannot see
 * arrivals, so 500 kg of rice reads healthy right up until a camp fills.
 *
 * Everything here comes from GET /api/resources/stock/outlook. Nothing in this
 * file computes a date, a rate or a quantity — it only formats what the API
 * returned. Days of cover, runout, reorder-by and suggested order quantities
 * are the backend's, unchanged.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 *
 *   people      how many are being served, and which way the number is moving
 *   forecast    the curve every date below rests on
 *   risk        how many items are in trouble, and when the first one lands
 *   inventory   the operational table — one row per item, details on demand
 *   coverage    how much of the measured basket this store actually stocks
 *   method      where the numbers come from, collapsed
 *
 * An earlier version stated its own methodology in full on the surface: a
 * Theil-Sen residual note under the population line, a paragraph under the
 * chart explaining the shaded band, a provenance essay under the table. All of
 * it was true and none of it was scannable — the reorder date an operator came
 * for sat behind four sentences about estimator choice. That material is all
 * still reachable, in tooltips, expandable rows and the methodology section.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Users, TrendingUp, TrendingDown,
} from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'
import PopulationForecastChart from './PopulationForecastChart'
import BasketCoverageCard from './BasketCoverageCard'
import ForecastMethodology from './ForecastMethodology'
import InfoHint from './InfoHint'
import { DISASTER_API_BASE } from '@/lib/apiBase'

const API = DISASTER_API_BASE

// ── formatting ──────────────────────────────────────────────────────────────
// Presentation only. Every value below is rendered as the API returned it;
// these helpers add separators, units and plurals and nothing else.

/** Thousands separators, and at most one decimal — 376.7 stays 376.7. */
function num(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  const n = Number(v)
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 })
}

// Unit symbols are invariant: "80 kg", never "80 kgs".
const INVARIANT_UNITS = new Set(['kg', 'g', 'mg', 'l', 'ml', 'lb', 'oz'])

/**
 * "1,000 bottles", "120 loaves", "80 kg".
 *
 * Naive `unit + "s"` produced "120 loafs" and "3 boxs" on real store lines, so
 * the handful of English rules that actually bite a unit noun are applied. The
 * quantity itself is never touched — only the word after it.
 */
function pluraliseUnit(unit) {
  const u = unit.toLowerCase()
  if (INVARIANT_UNITS.has(u)) return unit
  if (/(?:leaf|loaf)$/.test(u)) return `${unit.slice(0, -1)}ves`
  if (/(?:s|x|z|ch|sh)$/.test(u)) return `${unit}es`
  if (/[^aeiou]y$/.test(u)) return `${unit.slice(0, -1)}ies`
  return `${unit}s`
}

/** "1,000 bottles" — the value exactly as the API gave it, with its unit. */
function qty(value, unit) {
  if (value == null) return '—'
  const n = num(value)
  if (!unit) return n
  return `${n} ${Number(value) === 1 ? unit : pluraliseUnit(unit)}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

/** Hex accent -> low-alpha background that reads on either ground. */
function tint(hex, alpha = 0.15) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex))
  if (!m) return 'transparent'
  const [r, g, b] = m.slice(1).map((v) => parseInt(v, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// LOW reads as "Warning" here. The API's vocabulary is unchanged; only the
// label is, because "Low" beside a "Days left" column invites the reading
// "low days left", which is the opposite of what the status means.
const STATUS = (T) => ({
  CRITICAL:  { fg: T.red,   label: 'Critical' },
  LOW:       { fg: T.amber, label: 'Warning' },
  AVAILABLE: { fg: T.green, label: 'Available' },
  UNKNOWN:   { fg: T.dim,   label: 'Not forecast' },
})

// Triage order for the table: trouble first, then soonest to run out.
const TRIAGE_RANK = { CRITICAL: 0, LOW: 1, AVAILABLE: 2, UNKNOWN: 3 }

/** How a store line was matched, in the words an operator would use. */
const MATCH_LABEL = {
  exact:          'Exact',
  alias:          'Alias',
  token_subset:   'Word match',
  token_superset: 'Word match',
}

function StatusBadge({ T, status }) {
  const s = (STATUS(T))[status] || STATUS(T).UNKNOWN
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: tint(s.fg), color: s.fg, borderRadius: '9999px',
      padding: '3px 10px', fontSize: '0.71rem', fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 9999, background: s.fg }} />
      {s.label}
    </span>
  )
}

/** One headline number with a short label beneath it. */
function Metric({ T, value, label, accent, hint, icon }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 0, padding: '0.15rem 0' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '0.4rem',
        fontSize: '1.75rem', fontWeight: 800, lineHeight: 1.1,
        color: accent || T.textPrimary, fontVariantNumeric: 'tabular-nums',
      }}>
        {icon}
        {value}
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.3rem',
        marginTop: '0.3rem', fontSize: '0.75rem', color: T.muted, fontWeight: 600,
      }}>
        {label}
        {hint && <InfoHint text={hint} align="left" placement="bottom" size={12} />}
      </div>
    </div>
  )
}

/** A risk counter card. Prominent, because these are the decision triggers. */
function RiskCard({ T, value, label, sub, accent, active }) {
  return (
    <div style={{
      flex: '1 1 180px', minWidth: 0,
      background: active ? tint(accent, 0.09) : T.card,
      border: `1px solid ${active ? tint(accent, 0.45) : T.border}`,
      borderRadius: '0.9rem', padding: '0.95rem 1.1rem',
    }}>
      <div style={{
        fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.15,
        color: active ? accent : T.textPrimary, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', fontWeight: 700, color: T.textPrimary }}>
        {label}
      </div>
      {sub && (
        <div style={{ marginTop: '0.1rem', fontSize: '0.72rem', color: T.dim }}>{sub}</div>
      )}
    </div>
  )
}

/**
 * The detail an operator only wants for one row at a time: what the line was
 * read as, how confident that match is, and any warning attached to it.
 */
function ItemDetail({ T, item, leadTimeDays }) {
  const s = item.standardisation ?? {}
  const names = item.commodities_matched ?? (item.commodity_matched ? [item.commodity_matched] : [])
  const matchLabel = MATCH_LABEL[s.match_rule]
  const inferred = s.match_rule === 'token_subset' || s.match_rule === 'token_superset'

  const rows = []
  if (matchLabel) rows.push(['Match', matchLabel])
  if (names.length) {
    rows.push(['Matched commodity', names.length > 1 ? `${names[0]} + ${names.length - 1} more` : names[0]])
  }
  if (item.basket_share != null) rows.push(['Share of basket', `${(item.basket_share * 100).toFixed(1)}%`])
  if (item.runout_earliest && item.runout_latest && item.runout_earliest !== item.runout_latest) {
    rows.push(['Runs out between', `${fmtDate(item.runout_earliest)} – ${fmtDate(item.runout_latest)}`])
  }
  if (item.reorder_by) rows.push(['Lead time', `${leadTimeDays} days`])

  return (
    <div style={{
      background: T.cardSoft, borderTop: `1px solid ${T.border}`,
      padding: '0.9rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem',
    }}>
      {rows.length > 0 && (
        <div style={{
          display: 'grid', gap: '0.55rem 1.6rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        }}>
          {rows.map(([k, v]) => (
            <div key={k}>
              <div style={{
                fontSize: '0.66rem', fontWeight: 800, color: T.dim,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>{k}</div>
              <div style={{ fontSize: '0.8rem', color: T.ink, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {names.length > 1 && (
        <div style={{ fontSize: '0.74rem', color: T.muted, lineHeight: 1.6 }}>
          <strong style={{ color: T.textPrimary }}>Covers:</strong> {names.join(', ')}
        </div>
      )}

      {inferred && (
        <div style={{ fontSize: '0.74rem', color: T.blue, lineHeight: 1.6 }}>
          Matched because the words line up, not because a curated mapping says so. The share is a
          good guess rather than a stated one.
        </div>
      )}

      {item.note
        ? <div style={{ fontSize: '0.74rem', color: T.muted, lineHeight: 1.6 }}>{item.note}</div>
        : s.class_note
          ? <div style={{ fontSize: '0.74rem', color: T.muted, lineHeight: 1.6 }}>{s.class_note}</div>
          : null}

      {item.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {item.warnings.map((w, i) => (
            <div key={i} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              fontSize: '0.74rem', color: T.muted, lineHeight: 1.55,
            }}>
              <AlertTriangle size={13} style={{ color: T.amber, flexShrink: 0, marginTop: 3 }} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StockOutlookPanel() {
  const { T } = useTheme()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [days, setDays]       = useState(30)
  const [campId, setCampId]   = useState('SCB-UNIT-01')
  const [camps, setCamps]     = useState(['SCB-UNIT-01'])
  const [expanded, setExpanded] = useState(() => new Set())

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/resources/stock/outlook?days=${days}&camp_id=${encodeURIComponent(campId)}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setData(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [campId, days])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    async function loadCamps() {
      try {
        const res = await fetch(`${API}/api/resources/stock/camps`)
        if (!res.ok) return
        const body = await res.json()
        if (Array.isArray(body.camps) && body.camps.length) {
          setCamps(body.camps)
          if (!body.camps.includes(campId)) setCampId(body.camps[0])
        }
      } catch {
        // The default camp remains usable if the list endpoint is unavailable.
      }
    }
    loadCamps()
  }, [])

  const toggleRow = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // Items at risk first, then by how soon they run out — the order an operator
  // would triage in. Purely a sort; no value is recomputed.
  const items = useMemo(() => {
    if (!data?.items) return []
    return [...data.items].sort((a, b) => {
      const r = (TRIAGE_RANK[a.status] ?? 9) - (TRIAGE_RANK[b.status] ?? 9)
      if (r !== 0) return r
      const ac = a.days_cover ?? Infinity
      const bc = b.days_cover ?? Infinity
      return ac - bc
    })
  }, [data])

  if (loading && !data) {
    return <p style={{ color: T.muted, padding: '2rem' }}>Loading stock outlook…</p>
  }
  if (error) {
    return (
      <div style={{
        background: tint(T.red, 0.12), border: `1px solid ${T.red}`,
        borderRadius: '0.9rem', padding: '1rem', color: T.red,
      }}>
        <strong>Could not load stock outlook.</strong> {error}
      </div>
    )
  }

  const { summary, population, lead_time_days, provenance, allocation, horizon_days } = data
  const rising = (population.slope_per_day ?? 0) >= 0
  const trendColour = rising ? T.amber : T.blue
  const confColour =
    population.confidence === 'HIGH' ? T.green
    : population.confidence === 'MEDIUM' ? T.amber
    : T.red
  const confLabel =
    population.confidence === 'HIGH' ? 'High'
    : population.confidence === 'MEDIUM' ? 'Medium'
    : 'Low'
  const hasBand = population.daily?.some((d) => d.upper !== d.lower)

  // The fitted slope and the drawn curve are NOT the same rate: the backend
  // damps the trend over the horizon, so a +3.3/day fit projects 161 people in
  // 30 days rather than a straight-line 245. Headlining the raw slope on its
  // own invites exactly that wrong extrapolation, so the endpoint it actually
  // implies is stated alongside it. Neither number is recomputed here.
  const lastDay = population.daily?.length ? population.daily[population.daily.length - 1] : null
  const trendHint = lastDay
    ? `Fitted from recent check-in history. The forecast eases this rate off over time, projecting about ${num(lastDay.population)} people in ${horizon_days} days.`
    : 'Based on recent registration history.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.75rem', color: T.muted, fontWeight: 700 }}>
          Camp
          <select
            value={campId}
            onChange={(event) => setCampId(event.target.value)}
            style={{ marginLeft: '0.45rem', padding: '0.32rem 0.55rem', borderRadius: '0.45rem', border: `1px solid ${T.border}`, background: T.card, color: T.ink, fontWeight: 700 }}
          >
            {camps.map((camp) => <option key={camp} value={camp}>{camp}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '0.75rem', color: T.muted, fontWeight: 700 }}>Next</span>
        {[14, 30, 60].map((d) => (
          <button key={d} onClick={() => setDays(d)} style={{
            padding: '0.32rem 0.75rem', borderRadius: '9999px', cursor: 'pointer',
            border: `1px solid ${days === d ? T.teal : T.border}`,
            background: days === d ? T.tealLight : T.card,
            color: days === d ? T.tealDim : T.muted, fontWeight: 700, fontSize: '0.76rem',
          }}>{d} days</button>
        ))}
        <button onClick={load} disabled={loading} style={{
          marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
          padding: '0.32rem 0.75rem', borderRadius: '9999px', border: `1px solid ${T.border}`,
          background: T.card, color: T.muted, fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer',
        }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── People + forecast ────────────────────────────────────────────── */}
      <section style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: '0.9rem', padding: '1.15rem 1.15rem 0.5rem',
      }}>
        <div style={{
          display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
          paddingBottom: '0.9rem', borderBottom: `1px solid ${T.border}`,
        }}>
          <Metric
            T={T}
            value={num(population.current)}
            label="People now"
            icon={<Users size={19} style={{ color: T.dim, marginRight: 2 }} />}
          />
          <Metric
            T={T}
            value={`${rising ? '+' : ''}${num(population.slope_per_day)}/day`}
            label="Recent trend"
            accent={trendColour}
            hint={trendHint}
            icon={rising
              ? <TrendingUp size={19} style={{ color: trendColour, marginRight: 2 }} />
              : <TrendingDown size={19} style={{ color: trendColour, marginRight: 2 }} />}
          />
          <Metric
            T={T}
            value={confLabel}
            label="Forecast confidence"
            accent={confColour}
            hint={`Reflects how steady recent arrivals have been. Based on ${population.observations} day${population.observations === 1 ? '' : 's'} of check-in history.`}
          />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          paddingTop: '0.85rem', fontSize: '0.7rem', fontWeight: 800,
          color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Population forecast
          <InfoHint
            align="left"
            placement="bottom"
            text={hasBand
              ? 'Forecast range based on recent population variation. Each runout date is computed at the low, central and high population.'
              : `Too little history (${population.observations} day${population.observations === 1 ? '' : 's'}) to estimate a range, so only the central projection is drawn.`}
          />
          <span style={{
            marginLeft: 'auto', textTransform: 'none', letterSpacing: 0,
            fontWeight: 600, color: T.dim, fontSize: '0.72rem',
          }}>
            Next {horizon_days} days
          </span>
        </div>

        <PopulationForecastChart
          daily={population.daily}
          current={population.current}
          confidence={population.confidence}
        />

        {/* Short legend in place of the paragraph that used to sit here. */}
        <div style={{
          display: 'flex', gap: '1.1rem', flexWrap: 'wrap', justifyContent: 'center',
          padding: '0 0 0.75rem', fontSize: '0.72rem', color: T.muted,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 2, background: T.blue, borderRadius: 2 }} />
            Forecast
          </span>
          {hasBand && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 9, background: tint(T.blue, 0.28), borderRadius: 2 }} />
              Expected range
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, borderTop: `2px dashed ${T.dim}` }} />
            Today
          </span>
        </div>
      </section>

      {/* ── Inventory risk ───────────────────────────────────────────────── */}
      <div>
        <h2 style={{
          margin: '0 0 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: T.muted,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Inventory risk
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <RiskCard
            T={T} value={summary.critical} label="Critical"
            sub={`Under ${lead_time_days} days left`}
            accent={T.red} active={summary.critical > 0}
          />
          <RiskCard
            T={T} value={summary.low} label="Warning"
            sub={`Under ${lead_time_days * 2} days left`}
            accent={T.amber} active={summary.low > 0}
          />
          <RiskCard
            T={T}
            value={summary.next_runout ? fmtDate(summary.next_runout) : 'None'}
            label="Next runout"
            sub={summary.next_runout ? 'First item to run out' : `None in ${horizon_days} days`}
            accent={T.red} active={false}
          />
        </div>
      </div>

      {/* ── Inventory ────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{
          margin: '0 0 0.6rem', fontSize: '0.7rem', fontWeight: 800, color: T.muted,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Inventory
        </h2>

        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: '0.9rem', overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', minWidth: 820 }}>
              <thead>
                <tr style={{ background: T.bar }}>
                  {[
                    ['Resource', 'left'], ['Status', 'left'], ['Stock', 'right'],
                    ['Daily use', 'right'], ['Days left', 'right'], ['Runs out', 'right'],
                    ['Order by', 'right'], ['Order', 'right'], ['', 'right'],
                  ].map(([h, align], i) => (
                    <th key={h || i} style={{
                      textAlign: align, padding: '0.65rem 0.9rem',
                      fontSize: '0.66rem', fontWeight: 800, color: T.muted,
                      textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const open = expanded.has(it.id)
                  const critical = it.status === 'CRITICAL'
                  const warn = it.status === 'LOW'
                  // days_cover is capped at the horizon; when nothing runs out
                  // inside it, say so rather than implying an exact figure.
                  const beyond = it.days_cover != null && it.runout_date == null && it.days_cover >= horizon_days
                  return (
                    <tr key={it.id}
                        onClick={() => toggleRow(it.id)}
                        style={{ borderTop: `1px solid ${T.border}`, cursor: 'pointer' }}>
                      <td style={{ padding: '0.7rem 0.9rem', fontWeight: 700, color: T.textPrimary }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {it.resource_name}
                          {it.warnings?.length > 0 && (
                            <AlertTriangle size={12} style={{ color: T.amber, flexShrink: 0 }} />
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.7rem 0.9rem' }}>
                        <StatusBadge T={T} status={it.status} />
                      </td>
                      <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {qty(it.available_quantity, it.unit)}
                      </td>
                      <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: it.daily_use_now == null ? T.dim : T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {it.daily_use_now == null ? '—' : `${num(it.daily_use_now)}/day`}
                      </td>
                      <td style={{
                        padding: '0.7rem 0.9rem', textAlign: 'right', fontWeight: 800,
                        whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                        color: critical ? T.red : warn ? T.amber : it.days_cover == null ? T.dim : T.ink,
                      }}>
                        {it.days_cover == null ? '—' : `${num(it.days_cover)}${beyond ? '+' : ''} days`}
                      </td>
                      <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: it.runout_date ? T.ink : T.dim, whiteSpace: 'nowrap' }}>
                        {fmtDate(it.runout_date)}
                      </td>
                      <td style={{
                        padding: '0.7rem 0.9rem', textAlign: 'right', whiteSpace: 'nowrap',
                        fontWeight: critical ? 800 : 600,
                        color: critical ? T.red : it.reorder_by ? T.ink : T.dim,
                      }}>
                        {fmtDate(it.reorder_by)}
                      </td>
                      <td style={{ padding: '0.7rem 0.9rem', textAlign: 'right', color: it.suggested_order_qty ? T.ink : T.dim, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {it.suggested_order_qty ? qty(it.suggested_order_qty, it.unit) : '—'}
                      </td>
                      <td style={{ padding: '0.7rem 0.7rem', textAlign: 'right', color: T.dim, width: 34 }}>
                        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Detail panels sit outside the scroll container so they wrap
              normally instead of forcing the table wider. */}
          {items.filter((it) => expanded.has(it.id)).map((it) => (
            <div key={`d-${it.id}`}>
              <div style={{
                padding: '0.65rem 1.1rem 0', fontSize: '0.72rem', fontWeight: 800,
                color: T.dim, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: T.cardSoft, borderTop: `1px solid ${T.border}`,
              }}>
                {it.resource_name}
              </div>
              <ItemDetail T={T} item={it} leadTimeDays={lead_time_days} />
            </div>
          ))}

          <div style={{
            padding: '0.7rem 1.1rem', borderTop: `1px solid ${T.border}`,
            fontSize: '0.73rem', color: T.dim,
          }}>
            {summary.forecastable} of {summary.total_items} items forecast
            {summary.forecastable < summary.total_items && ' — the rest have no daily draw rate'}
            . Select a row for details.
          </div>
        </div>
      </div>

      {/* ── Coverage + methodology ───────────────────────────────────────── */}
      <BasketCoverageCard items={data.items} allocation={allocation} provenance={provenance} />
      <ForecastMethodology
        provenance={provenance}
        population={population}
        leadTimeDays={lead_time_days}
      />
    </div>
  )
}
