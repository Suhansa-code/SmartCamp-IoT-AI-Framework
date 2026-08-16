'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, CheckCircle2, ShieldAlert, ServerCrash, Layers } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

function Panel({ icon, iconColor, title, right, children, bodyStyle }) {
  const { T } = useTheme()
  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 18,
      boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
      overflow: 'hidden', flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.9rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon}
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</span>
        </div>
        {right}
      </div>
      <div style={{ padding: '1rem 1.1rem', ...bodyStyle }}>{children}</div>
    </div>
  )
}

export default function StatsPanel({ stats, buffer, metrics, networkState }) {
  const { T } = useTheme()
  const s = stats || {}
  const totalCrit = (s.critical_sent || 0) + (s.critical_buffered || 0)
  const deliveryRate = totalCrit > 0 ? ((s.critical_sent / totalCrit) * 100).toFixed(1) : '100.0'

  let drColor = T.green
  if (+deliveryRate < 70) drColor = T.red
  else if (+deliveryRate < 95) drColor = T.amber

  const priorityColor = (T, p) => ({
    CRITICAL: T.red,
    IMPORTANT: T.amber,
    ROUTINE: T.blue,
  }[p] || T.muted)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', height: '100%' }}>
      {/* Delivery Statistics */}
      <Panel
        icon={<Activity size={17} color={T.green} />}
        title="Delivery Statistics"
      >
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Critical Delivery Rate</div>
          <div style={{ fontSize: '2.6rem', fontWeight: 800, color: drColor, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {deliveryRate}<span style={{ fontSize: '1.3rem' }}>%</span>
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>target ≥ 95%</div>
          <div style={{ height: 8, borderRadius: 99, background: T.bar, overflow: 'hidden', marginTop: 12 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(+deliveryRate, 100)}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{ height: '100%', borderRadius: 99, background: `linear-gradient(90deg, ${drColor}88, ${drColor})` }}
            />
          </div>
        </div>

        <div>
          {[
            { label: 'Total Sent',        value: s.total_sent || 0,        color: T.green },
            { label: 'Total Buffered',    value: s.total_buffered || 0,    color: T.amber },
            { label: 'Total Dropped',     value: s.total_dropped || 0,     color: T.red },
            { label: 'Critical Sent',     value: s.critical_sent || 0,     color: T.green },
            { label: 'Critical Buffered', value: s.critical_buffered || 0, color: T.amber },
          ].map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: `1px solid ${T.line}`, fontSize: '0.82rem' }}>
              <span style={{ color: T.muted, fontWeight: 600 }}>{row.label}</span>
              <span style={{ color: row.color, fontWeight: 800 }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '1rem', padding: '0.6rem 0.9rem', borderRadius: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: metrics?.bridge_alive ? `${T.green}1a` : `${T.red}1a`,
          border: `1px solid ${metrics?.bridge_alive ? T.green : T.red}55`,
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}>
            {metrics?.bridge_alive ? <CheckCircle2 size={15} color={T.green} /> : <ServerCrash size={15} color={T.red} />}
            Cloud Bridge
          </span>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', color: metrics?.bridge_alive ? T.green : T.red }}>
            {metrics?.bridge_alive ? 'CONNECTED' : 'OFFLINE'}
          </span>
        </div>
      </Panel>

      {/* Priority Buffer */}
      <Panel
        icon={<Layers size={17} color={T.tealMid} />}
        title="Priority Buffer"
        right={
          <span style={{
            padding: '2px 10px', borderRadius: 999, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em',
            background: buffer.length > 0 ? `${T.amber}1a` : T.bgSoft,
            border: `1px solid ${buffer.length > 0 ? T.amber : T.border}55`,
            color: buffer.length > 0 ? T.amber : T.muted,
          }}>
            {buffer.length} QUEUED
          </span>
        }
        bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1 }}
      >
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 220 }}>
          {buffer.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', color: T.muted }}>
              <CheckCircle2 size={38} style={{ opacity: 0.5 }} />
              <p style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 8 }}>Buffer Empty</p>
              <p style={{ fontSize: '0.78rem', opacity: 0.75 }}>All messages delivered to cloud</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <AnimatePresence>
                {buffer.slice(0, 10).map((msg, i) => {
                  const pc = priorityColor(T, msg.priority)
                  const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—')
                  return (
                    <motion.div
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        padding: '0.6rem 0.8rem', borderRadius: 10,
                        background: T.bgSoft, border: `1px solid ${T.border}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: T.textPrimary, textTransform: 'capitalize' }}>
                          {msg.source || msg.source_type} <span style={{ color: T.muted }}>·</span> {(msg.action || '').replace(/_/g, ' ')}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: T.muted, fontFamily: 'monospace', marginTop: 2 }}>{timeStr}</div>
                      </div>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.06em',
                        background: `${pc}1a`, border: `1px solid ${pc}55`, color: pc,
                      }}>
                        {(msg.priority || '').slice(0, 4)}
                      </span>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {networkState !== 'OFFLINE' && buffer.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: 10,
              background: `${T.green}1a`, border: `1px solid ${T.green}55`,
              fontSize: '0.78rem', fontWeight: 700, color: T.green,
              textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <ShieldAlert size={15} /> Reconnected — Flushing CRITICAL records first
          </motion.div>
        )}
      </Panel>
    </div>
  )
}