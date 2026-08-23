'use client'

import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { useTheme } from '@/components/common/ThemeProvider'

export default function ScoreSparkline({ scores }) {
  const { T } = useTheme()
  const last = scores[scores.length - 1]?.score ?? 0
  const lineColor = last >= 70 ? T.green : last >= 50 ? T.amber : T.red

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: T.bgDeep, border: `1px solid ${T.border}`, borderRadius: '8px', padding: '4px 10px' }}>
        <p style={{ color: T.textPrimary, fontSize: '0.78rem', fontWeight: 700, margin: 0 }}>
          S{payload[0]?.payload?.session}: {payload[0]?.value}
        </p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 56 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <ReferenceLine y={50} stroke={T.amber} strokeDasharray="3 3" strokeOpacity={0.5} />
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