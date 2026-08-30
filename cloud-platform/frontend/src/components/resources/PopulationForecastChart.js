'use client'

/**
 * The population forecast, drawn.
 *
 * Every date on the stock page is downstream of this one curve: days of cover,
 * runout, reorder-by. The panel used to state the forecast in a sentence
 * ("+18.4/day, HIGH confidence") and then show only its consequences, which
 * made the numbers hard to argue with — an operator could see that rice runs
 * out on Tuesday but not what population that assumed.
 *
 * Three things are drawn, and the band is the point:
 *
 *   band     lower..upper from the median absolute residual, widening with the
 *            horizon. A wide band IS the answer when history is short; hiding
 *            it would make a cold-start guess look like a measurement.
 *   line     the damped-trend central projection
 *   marker   today's observed headcount, so the projection is visibly anchored
 *            to something real rather than floating
 *
 * Reads population.daily from GET /api/resources/stock/outlook.
 */
import { useEffect, useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/components/common/ThemeProvider'

const shortDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })

function ChartTooltip({ active, payload, label, T, confidence }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const spread = row.upper - row.lower
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: '9px 12px', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', fontSize: 12.5,
    }}>
      <div style={{ fontWeight: 700, color: T.textPrimary, marginBottom: 5 }}>
        {shortDate(label)}
        <span style={{ color: T.dim, fontWeight: 500 }}>
          {row.day_offset === 0 ? '  · today' : `  · day +${row.day_offset}`}
        </span>
      </div>
      <div style={{ color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
        <strong>{row.population.toLocaleString('en-GB')}</strong> people
      </div>
      {spread > 0 && (
        <div style={{ color: T.dim, fontSize: 11.5, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          {row.lower.toLocaleString('en-GB')} – {row.upper.toLocaleString('en-GB')} ({confidence} confidence)
        </div>
      )}
    </div>
  )
}

/**
 * @param {Array}  daily       population.daily — [{date, day_offset, population, lower, upper}]
 * @param {number} current     population.current, drawn as the anchor line
 * @param {string} confidence  LOW | MEDIUM | HIGH, shown in the tooltip
 * @param {number} [height]
 */
export default function PopulationForecastChart({ daily = [], current, confidence, height = 220 }) {
  const { T } = useTheme()

  // ResponsiveContainer measures its parent, which has no layout during server
  // rendering — it warns about a -1 size and flashes on hydration. Render only
  // after mount; the reserved-height box keeps the page from shifting.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!daily.length) return null
  if (!mounted) return <div style={{ width: '100%', height }} aria-hidden="true" />

  // Recharts draws a band from a [low, high] tuple on one dataKey.
  const data = daily.map((d) => ({ ...d, band: [d.lower, d.upper] }))
  const hasBand = data.some((d) => d.upper !== d.lower)
  const colour = T.blue

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ComposedChart data={data} margin={{ top: 10, right: 18, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="popFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity={0.20} />
              <stop offset="100%" stopColor={colour} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={T.border} strokeOpacity={0.5} vertical={false} />
          <XAxis
            dataKey="date" tickFormatter={shortDate} tickLine={false}
            axisLine={{ stroke: T.border }} tick={{ fill: T.dim, fontSize: 11 }}
            dy={4} interval="preserveStartEnd" minTickGap={28}
          />
          <YAxis
            tickLine={false} axisLine={false} width={52}
            tick={{ fill: T.dim, fontSize: 11 }}
            tickFormatter={(v) => v.toLocaleString('en-GB')}
          />
          <Tooltip
            content={<ChartTooltip T={T} confidence={confidence} />}
            cursor={{ stroke: T.dim, strokeDasharray: '3 3' }}
          />

          {Number.isFinite(current) && (
            <ReferenceLine
              y={current} stroke={T.dim} strokeDasharray="5 4"
              label={{
                value: `today ${current.toLocaleString('en-GB')}`,
                position: 'insideTopLeft', fill: T.dim, fontSize: 10.5, dy: -4,
              }}
            />
          )}

          {hasBand && (
            <Area
              type="monotone" dataKey="band" stroke="none"
              fill={colour} fillOpacity={0.14} isAnimationActive={false}
            />
          )}
          <Area
            type="monotone" dataKey="population" stroke="none"
            fill="url(#popFill)" isAnimationActive={false}
          />
          <Line
            type="monotone" dataKey="population" stroke={colour} strokeWidth={2}
            dot={false} activeDot={{ r: 5, fill: colour, stroke: T.card, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
