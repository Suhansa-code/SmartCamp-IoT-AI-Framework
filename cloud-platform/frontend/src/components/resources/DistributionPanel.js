'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { timeAgo } from '@/components/common/utils'
import Button from '@/components/common/Button'
import { API_BASE } from "@/lib/apiBase";

// Cloud-side distribution planner.
// Food and drinking water only — shelter and medical staffing are out of scope
// for the Sri Lanka resource model that backs this page.
//
// Data path: EMQX → CampDataService → /api/resources/distribution/*
// Rates come from prediction-models/models/lka_v2/ration_rates.json.
//
// This panel runs on a light surface while the app chrome stays dark, so the
// chart palette is chosen and validated for a white background rather than
// inherited from the dark dashboard tokens.

const API = API_BASE

// ── palette ─────────────────────────────────────────────────────────────────
// Validated against a white surface: lightness band, chroma floor, CVD
// separation and contrast all pass.
const T = {
  surface:  '#FFFFFF',
  page:     '#F7F8FA',
  line:     '#E3E7EC',
  lineSoft: '#EDF0F4',

  ink:      '#111827',
  inkSoft:  '#4B5563',
  inkFaint: '#8A94A3',

  food:     '#0D9488',   // brand teal — passes all checks on white
  pop:      '#2a78d6',
  water:    '#1baf7a',
  flat:     '#9AA4B2',   // reference line: neutral, never a categorical hue

  good:     '#15803D',
  warn:     '#B45309',
  warnBg:   '#FEF6E7',
  danger:   '#B42318',
}

const confidenceColor = (c) => ({ HIGH: T.good, MEDIUM: T.warn, LOW: T.inkFaint }[c] || T.inkFaint)

const num = (v, d = 1) =>
  v === null || v === undefined ? '—'
    : Number(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })

const int = (v) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('en-GB'))

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// ── building blocks ─────────────────────────────────────────────────────────

function Card({ children, style }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10,
      padding: 18, boxShadow: '0 1px 2px rgba(17,24,39,0.04)', ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, hint }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: T.ink, letterSpacing: -0.1 }}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: T.inkFaint }}>{hint}</span>}
    </div>
  )
}

function BigStat({ value, unit, label, color }) {
  return (
    <Card style={{ flex: '1 1 190px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 11, color: T.inkFaint, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        <span style={{ fontSize: 13, color: T.inkSoft, fontWeight: 600 }}>{unit}</span>
      </div>
    </Card>
  )
}

function ChartTooltip({ active, payload, label, unit, showBand }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.line}`, borderRadius: 8,
      padding: '9px 12px', boxShadow: '0 4px 14px rgba(17,24,39,0.10)', fontSize: 12.5,
    }}>
      <div style={{ fontWeight: 700, color: T.ink, marginBottom: 5 }}>{shortDate(label)}</div>
      <div style={{ color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
        <strong style={{ color: T.ink }}>{num(row.value)}</strong> {unit}
      </div>
      {showBand && row.low !== row.high && (
        <div style={{ color: T.inkFaint, fontSize: 11.5, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          range {num(row.low)}–{num(row.high)}
        </div>
      )}
      <div style={{ color: T.inkFaint, fontSize: 11.5, marginTop: 3 }}>
        {row.offset === 0 ? 'today' : `day +${row.offset}`}
      </div>
    </div>
  )
}

/**
 * One measure over the horizon: an uncertainty band, a line, and an optional
 * neutral reference line. Single axis by design — food and population are
 * different units and get their own charts rather than a second y-scale.
 */
function ForecastChart({ data, color, unit, height = 190, reference, referenceLabel }) {
  // ResponsiveContainer measures its parent, which has no layout during server
  // rendering — it warns about a -1 size and flashes. Render the chart only
  // after mount; the reserved-height box keeps the page from shifting.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const hasBand = data.some((d) => d.low !== d.high)
  const gradientId = `fill-${unit.replace(/\W/g, '')}`

  if (!mounted) return <div style={{ width: '100%', height }} aria-hidden="true" />

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={T.lineSoft} vertical={false} />
          <XAxis
            dataKey="date" tickFormatter={shortDate} tickLine={false}
            axisLine={{ stroke: T.line }} tick={{ fill: T.inkFaint, fontSize: 11 }}
            dy={4} interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false} axisLine={false} width={54}
            tick={{ fill: T.inkFaint, fontSize: 11 }}
            tickFormatter={(v) => v.toLocaleString('en-GB')}
          />
          <Tooltip
            content={<ChartTooltip unit={unit} showBand={hasBand} />}
            cursor={{ stroke: T.inkFaint, strokeDasharray: '3 3' }}
          />

          {reference !== undefined && (
            <ReferenceLine
              y={reference} stroke={T.flat} strokeDasharray="5 4"
              label={{ value: referenceLabel, position: 'insideTopRight',
                       fill: T.inkFaint, fontSize: 10.5, dy: -4 }}
            />
          )}

          {hasBand && (
            <Area
              type="monotone" dataKey="band" stroke="none"
              fill={color} fillOpacity={0.12} isAnimationActive={false}
            />
          )}
          <Area
            type="monotone" dataKey="value" stroke="none"
            fill={`url(#${gradientId})`} isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="value" stroke={color} strokeWidth={2}
            dot={{ r: 3, fill: T.surface, stroke: color, strokeWidth: 2 }}
            activeDot={{ r: 5, fill: color, stroke: T.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function PlanTable({ daily, hasBand }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 480 }}>
        <thead>
          <tr style={{ color: T.inkFaint, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.8 }}>
            <th style={{ textAlign: 'left',  padding: '7px 10px', fontWeight: 700 }}>Date</th>
            <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700 }}>People</th>
            <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700 }}>Food kg</th>
            <th style={{ textAlign: 'right', padding: '7px 10px', fontWeight: 700 }}>Water L</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
              <td style={{ padding: '8px 10px', color: T.ink, fontWeight: d.day_offset === 0 ? 800 : 500 }}>
                {shortDate(d.date)}
                {d.day_offset === 0 && <span style={{ color: T.food, fontSize: 10.5, fontWeight: 700 }}> · today</span>}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {int(d.population)}
                {hasBand && d.population_high > d.population_low && (
                  <span style={{ color: T.inkFaint, fontSize: 10.5 }}> ({int(d.population_low)}–{int(d.population_high)})</span>
                )}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: T.ink, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {num(d.food_kg_day)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                {num(d.water_liters_day)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── main component ───────────────────────────────────────────────────────────

export default function DistributionPanel() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const planRes = await fetch(`${API}/api/resources/distribution/plan?days=7`)
      if (!planRes.ok) throw new Error(`HTTP ${planRes.status}`)
      setPlan(await planRes.json())
      setLastUpdate(Date.now())
      setError(null)
    } catch {
      setError('Cannot reach cloud backend on port 3001')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30_000)
    return () => clearInterval(id)
  }, [fetchAll])

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: T.inkFaint }}>
        Loading distribution plan…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontWeight: 700, color: T.danger, marginBottom: 6 }}>{error}</div>
        <Button variant="teal" circleIcon={false} onClick={fetchAll} style={{ marginTop: 12 }}>Retry</Button>
      </div>
    )
  }

  const daily = plan?.plan?.daily ?? []
  const today = daily[0]
  const pop = plan?.plan?.population
  const cohorts = plan?.cohorts
  const hasBand = pop?.method === 'theil_sen_with_band'

  const foodSeries = daily.map((d) => ({
    date: d.date, offset: d.day_offset, value: d.food_kg_day,
    low: d.food_kg_low, high: d.food_kg_high, band: [d.food_kg_low, d.food_kg_high],
  }))
  const popSeries = daily.map((d) => ({
    date: d.date, offset: d.day_offset, value: d.population,
    low: d.population_low, high: d.population_high, band: [d.population_low, d.population_high],
  }))
  const waterSeries = daily.map((d) => ({
    date: d.date, offset: d.day_offset, value: d.water_liters_day,
    low: d.water_liters_day, high: d.water_liters_day, band: [d.water_liters_day, d.water_liters_day],
  }))

  return (
    <div style={{ background: T.page, minHeight: '100%', padding: '1.25rem 1.5rem 3rem',
                  display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: T.ink }}>Distribution Plan</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.8, padding: '3px 9px', borderRadius: 99,
            color: confidenceColor(pop?.confidence), border: `1px solid ${confidenceColor(pop?.confidence)}`,
          }}>{pop?.confidence} CONFIDENCE</span>
          <span style={{ fontSize: 11.5, color: T.inkFaint }}>
            updated {lastUpdate ? timeAgo(new Date(lastUpdate)) : '—'}
          </span>
        </div>
      </div>

      {/* ── states ─────────────────────────────────────────────── */}
      {cohorts?.total === 0 && (
        <Card>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.ink, marginBottom: 6 }}>No one is registered yet</div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>
            The forecast is driven by registrations arriving from the camp over EMQX. Until the first
            person is registered every figure below is zero — this is an empty camp, not a failed calculation.
          </div>
        </Card>
      )}

      {cohorts?.total > 0 && pop?.method === 'flat_hold' && (
        <div style={{ padding: '13px 17px', borderRadius: 10, background: T.warnBg, border: `1px solid ${T.warn}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.warn, marginBottom: 4 }}>
            Population held flat — not enough history to fit a trend
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, lineHeight: 1.6 }}>
            {pop.observations} day{pop.observations === 1 ? '' : 's'} of registration history so far. The
            trend estimator needs 3 distinct days before it can project growth, and 7 before it reports an
            uncertainty band. Today’s requirement is exact; the next six days simply repeat it.
          </div>
        </div>
      )}

      {/* ── today ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <BigStat value={num(today?.food_kg_day)} unit="kg" label="Food today" color={T.food} />
        <BigStat value={num(today?.water_liters_day)} unit="L" label="Drinking water today" color={T.water} />
        <BigStat value={int(today?.population)} unit="people" label="Registered" color={T.ink} />
      </div>

      {/* ── the forecast, as charts ────────────────────────────── */}
      <Card>
        <SectionTitle hint={`${pop?.observations ?? 0} day(s) of history · ${pop?.method}${hasBand ? ' · shaded band is the uncertainty range' : ''}`}>
          Food required over the next {plan?.plan?.horizon_days ?? 7} days
        </SectionTitle>
        <ForecastChart
          data={foodSeries} color={T.food} unit="kg"
          reference={today?.food_kg_day}
          referenceLabel="today's level"
        />
        <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
          The dashed line is today’s requirement held flat. The gap between it and the curve is what the
          population trend adds.
        </div>
      </Card>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Card>
          <SectionTitle hint="fitted on live registrations">Registered people</SectionTitle>
          <ForecastChart data={popSeries} color={T.pop} unit="people" height={160} />
        </Card>
        <Card>
          <SectionTitle hint="3 L per person per day">Drinking water</SectionTitle>
          <ForecastChart data={waterSeries} color={T.water} unit="L" height={160} />
        </Card>
      </div>

      {/* ── the numbers behind the charts ──────────────────────── */}
      <Card>
        <SectionTitle hint="the same figures the charts are drawn from">Day by day</SectionTitle>
        <PlanTable daily={daily} hasBand={hasBand} />
        <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 12, lineHeight: 1.55 }}>
          {pop?.note} Demographic ratios are held constant across the horizon.
        </div>
      </Card>

    </div>
  )
}
