'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Cpu, Network, Zap } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'
import { FEATURES, QOS_MATRIX } from '@/data/network.data'

function Panel({ icon, title, children }) {
  const { T } = useTheme()
  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 18,
      boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.9rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>
        {icon}
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
      </div>
      <div style={{ padding: '1rem 1.1rem' }}>{children}</div>
    </div>
  )
}

export default function NetworkPanel({ networkState, metrics }) {
  const { T } = useTheme()
  const m = metrics || {}

  const stateColor = {
    GOOD: T.green, WEAK: T.amber, POOR: T.coral, OFFLINE: T.red,
  }[networkState] || T.slate
  const stateIndex = ['GOOD', 'WEAK', 'POOR', 'OFFLINE'].indexOf(networkState)
  const PRIORITY_COLORS = { CRITICAL: T.red, IMPORTANT: T.amber, ROUTINE: T.blue }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* ML Feature Importance Panel */}
      <Panel icon={<Cpu size={17} color={T.tealMid} />} title="Random Forest · 19 Features">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {FEATURES.map((feat, i) => {
            const raw = m[feat.key]
            const val = raw !== undefined ? feat.fmt(raw) : '—'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: T.muted, width: 96, flexShrink: 0 }}>{feat.label}</div>
                <div style={{ flex: 1, height: 6, borderRadius: 99, background: T.bar, overflow: 'hidden' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${feat.importance * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${stateColor}88, ${stateColor})` }}
                  />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: T.textPrimary, width: 60, textAlign: 'right', flexShrink: 0 }}>{val}</div>
              </div>
            )
          })}
        </div>

        <div style={{
          marginTop: '1rem', padding: '0.8rem 1rem', borderRadius: 12,
          background: `${stateColor}1a`, border: `1px solid ${stateColor}55`,
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Prediction (60s Ahead)</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: stateColor, lineHeight: 1.2 }}>{networkState}</div>
          <div style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={13} color={T.amber} /> Inference &lt;5ms · Pi 5
          </div>
        </div>
      </Panel>

      {/* QoS Decision Matrix */}
      <Panel icon={<Network size={17} color={T.blue} />} title="QoS Decision Matrix">
        <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(4, 1fr)', gap: 6, marginBottom: '1rem' }}>
          <div />
          {['GOOD', 'WEAK', 'POOR', 'OFF'].map((h, i) => (
            <div key={i} style={{
              textAlign: 'center', padding: '0.45rem 0', borderRadius: 8,
              background: T.bgSoft, border: `1px solid ${T.border}`,
              fontSize: '0.62rem', fontWeight: 800, color: T.muted, letterSpacing: '0.06em',
            }}>{h}</div>
          ))}

          {Object.entries(QOS_MATRIX).map(([priority, cells]) => (
            <React.Fragment key={priority}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: PRIORITY_COLORS[priority], display: 'flex', alignItems: 'center' }}>{priority}</div>
              {cells.map((cell, ci) => {
                const isActive = stateIndex === ci
                const isBad = cell === 'Buffer' || cell === 'Drop'
                const cellColor = cell === 'Buffer' ? T.amber : cell === 'Drop' ? T.red : T.green
                return (
                  <div key={ci} style={{
                    textAlign: 'center', padding: '0.5rem 0', borderRadius: 8,
                    fontSize: '0.68rem', fontWeight: isActive ? 800 : 600,
                    color: cellColor,
                    background: isActive ? `${cellColor}22` : T.bgSoft,
                    border: isActive ? `2px solid ${cellColor}` : `1px solid ${T.border}`,
                    opacity: isActive ? 1 : 0.6,
                  }}>
                    {cell}
                  </div>
                )
              })}
            </React.Fragment>
          ))}
        </div>

        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>Buffer Flush Order on Reconnect</div>
        {[
          { label: '1st — CRITICAL',  color: T.red },
          { label: '2nd — IMPORTANT', color: T.amber },
          { label: '3rd — ROUTINE',   color: T.blue },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.3rem 0', fontSize: '0.75rem', fontWeight: 700, color: T.textPrimary }}>
            <span style={{ width: 26, height: 6, borderRadius: 99, background: row.color, boxShadow: `0 0 8px ${row.color}` }} />
            {row.label}
          </div>
        ))}
      </Panel>
    </div>
  )
}