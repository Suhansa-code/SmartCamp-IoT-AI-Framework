'use client'

import React from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

function MiniChart({ data, dataKey, color }) {
  if (!data || data.length < 2) return null
  return (
    <ResponsiveContainer width={120} height={50}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={3}
          dot={false}
          isAnimationActive={false}
          strokeLinecap="round"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

const getValColorInfo = (T, v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5
  if (bad) return T.red
  if (warn2) return T.amber
  return T.green
}

export default function StatCards({ metrics, history }) {
  const { T } = useTheme()
  const m = metrics || {}

  const cards = [
    { label: 'RTT Average', value: m.rtt_avg || 0, unit: 'ms', color: getValColorInfo(T, m.rtt_avg || 0, 100, 300), dataKey: 'rtt_avg' },
    { label: 'Packet Loss', value: m.packet_loss || 0, unit: '%', color: getValColorInfo(T, m.packet_loss || 0, 5, 20), dataKey: 'packet_loss' },
    { label: 'Queue Depth', value: m.queue_depth || 0, unit: 'msgs', color: getValColorInfo(T, m.queue_depth || 0, 10, 50), dataKey: 'queue_depth' },
    { label: 'Throughput', value: m.throughput || 0, unit: 'msg/s', color: getValColorInfo(T, m.throughput || 0, 5, 12, true), dataKey: 'throughput' },
  ]

  return (
    <div className="grid-kpi" style={{ marginBottom: '1.25rem' }}>
      {cards.map((card, i) => {
        const displayVal = typeof card.value === 'number' ? card.value.toFixed(card.value > 99 ? 0 : 1) : card.value
        const lastTwo = history.slice(-2)
        let trend = null
        if (lastTwo.length === 2) {
          const t = (lastTwo[1][card.dataKey] - lastTwo[0][card.dataKey]).toFixed(1)
          trend = parseFloat(t)
        }
        const isThroughput = card.dataKey === 'throughput'
        let trendStatus = 'neutral'
        if (trend !== null && trend !== 0) {
          trendStatus = trend > 0 ? (isThroughput ? 'good' : 'bad') : (isThroughput ? 'bad' : 'good')
        }
        const trendColor = trendStatus === 'good' ? T.green : trendStatus === 'bad' ? T.red : T.muted

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            style={{
              position: 'relative', overflow: 'hidden',
              background: `linear-gradient(145deg, ${T.card} 0%, ${T.bg} 100%)`,
              border: `1px solid ${T.border}`,
              borderTop: `3px solid ${card.color}`,
              borderRadius: 16,
              padding: '1rem 1.1rem',
              boxShadow: '0 10px 26px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ position: 'absolute', top: -26, right: -26, width: 92, height: 92, borderRadius: '50%', background: `${card.color}24`, filter: 'blur(28px)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, position: 'relative' }}>
              <div>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{card.label}</span>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: '1.7rem', fontWeight: 800, color: card.color, lineHeight: 1, letterSpacing: '-0.01em' }}>{displayVal}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: T.muted }}>{card.unit}</span>
                </div>
              </div>
              <div style={{ opacity: 0.85, marginTop: 4 }}>
                <MiniChart data={history} dataKey={card.dataKey} color={card.color} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: '0.72rem', fontWeight: 700 }}>
              {trend > 0 ? (
                <TrendingUp size={14} color={trendColor} />
              ) : trend < 0 ? (
                <TrendingDown size={14} color={trendColor} />
              ) : (
                <Minus size={14} color={T.muted} />
              )}
              <span style={{ color: trendColor }}>{Math.abs(trend ?? 0)} vs last</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}