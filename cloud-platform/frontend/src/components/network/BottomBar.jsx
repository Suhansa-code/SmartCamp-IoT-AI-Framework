'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '@/components/common/ThemeProvider'
import { STAT_THRESHOLDS } from '@/data/network.data'

const getValColorInfo = (T, v, warn, crit, invert = false) => {
  const bad = invert ? v < warn : v > crit
  const warn2 = invert ? v > warn * 1.5 : v > warn * 1.5
  if (bad) return T.red
  if (warn2) return T.amber
  return T.green
}

const getDropRateColorInfo = (T, v) => {
  if (v > 2) return T.red
  if (v > 0) return T.coral
  return T.green
}

const getQueueDeltaColorInfo = (T, v) => {
  if (v > 10) return T.coral
  if (v > 0) return T.amber
  return T.green
}

export default function BottomBar({ metrics }) {
  const { T } = useTheme()
  const m = metrics || {}

  const items = [
    { label: 'Jitter', value: `${m.jitter || 0}ms`, color: getValColorInfo(T, m.jitter || 0, STAT_THRESHOLDS.jitter.warn, STAT_THRESHOLDS.jitter.crit) },
    { label: 'Bandwidth', value: `${m.bandwidth || 0} Mbps`, color: T.blue },
    { label: 'Drop Rate', value: `${m.drop_rate || 0}/s`, color: getDropRateColorInfo(T, m.drop_rate || 0) },
    { label: 'WiFi Clients', value: m.clients || 0, color: T.green },
    { label: 'Throughput', value: `${m.throughput || 0} msg/s`, color: getValColorInfo(T, m.throughput || 0, STAT_THRESHOLDS.throughput.warn, STAT_THRESHOLDS.throughput.crit, true) },
    { label: 'Queue Δ', value: `${(m.queue_delta || 0) >= 0 ? '+' : ''}${m.queue_delta || 0}`, color: getQueueDeltaColorInfo(T, m.queue_delta || 0) },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          style={{
            position: 'relative', overflow: 'hidden',
            background: `linear-gradient(145deg, ${T.card} 0%, ${T.bg} 100%)`,
            border: `1px solid ${T.border}`,
            borderTop: `3px solid ${item.color}`,
            borderRadius: 14,
            padding: '0.8rem 1rem',
            boxShadow: '0 8px 22px rgba(0,0,0,0.16)',
          }}
        >
          <div style={{ fontSize: '0.62rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{item.label}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: item.color, letterSpacing: '-0.01em' }}>{item.value}</div>
        </motion.div>
      ))}
    </div>
  )
}