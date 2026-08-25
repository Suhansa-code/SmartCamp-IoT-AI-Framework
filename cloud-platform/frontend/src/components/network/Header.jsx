'use client'

import { motion } from 'framer-motion'
import { Activity, Box, Server } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

export default function Header({ networkState, connected, metrics }) {
  const { T } = useTheme()

  const stateColor = {
    GOOD: T.green,
    WEAK: T.amber,
    POOR: T.coral,
    OFFLINE: T.red,
  }[networkState] || T.green

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, marginBottom: '1.4rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 22px rgba(37,99,235,0.4)', flexShrink: 0,
        }}>
          <Activity size={24} />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: T.tealMid, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 4 }}>
            <Box size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Smart Camp Box · Semantic-Aware
          </div>
          <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: T.textPrimary }}>
            SAAMP Network Monitor
          </h1>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {/* Connection status */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999,
          padding: '4px 12px', fontSize: '0.72rem', fontWeight: 700,
          color: connected ? T.green : T.red,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? T.green : T.red,
            boxShadow: `0 0 8px ${connected ? T.green : T.red}`,
            animation: 'pulse 2s infinite',
          }} />
          {connected ? 'LIVE' : 'DISCONNECTED'}
        </span>

        {/* Predicted state */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: `${stateColor}1a`, border: `1px solid ${stateColor}55`,
          borderRadius: 12, padding: '6px 12px',
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Predicted (60s)</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: stateColor, lineHeight: 1.1 }}>{networkState}</div>
          </div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor, boxShadow: `0 0 10px ${stateColor}`, animation: 'pulse 2s infinite' }} />
        </span>

        {/* MQTT broker */}
        <span style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: '6px 12px',
        }}>
          <Server size={18} color={metrics?.bridge_alive ? T.blue : T.muted} />
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>MQTT Broker</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: metrics?.bridge_alive ? T.green : T.red, lineHeight: 1.1 }}>
              {metrics?.bridge_alive ? 'CONNECTED' : 'OFFLINE'}
              <span style={{ color: T.muted, fontWeight: 600 }}> · {metrics?.clients || 0} clients</span>
            </div>
          </div>
        </span>
      </div>
    </motion.div>
  )
}