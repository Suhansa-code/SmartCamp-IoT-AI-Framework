'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { P } from '@/data/theme.data'

export default function ScoreSparkline({ scores }) {
  const last = scores[scores.length - 1]?.score ?? 0
  const lineColor = last >= 70 ? P.green : last >= 50 ? P.amber : P.red

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: P.dark, border: `1px solid ${P.dark}`, borderRadius: '8px', padding: '4px 10px' }}>
        <p style={{ color: '#fff', fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>
          S{payload[0]?.payload?.session}: {payload[0]?.value}
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={50} stroke={P.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone" dataKey="score" stroke={lineColor} strokeWidth={2.5}
            dot={{ r: 3, fill: lineColor, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: lineColor }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}