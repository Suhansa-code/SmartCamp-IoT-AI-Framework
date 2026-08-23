'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Activity, ListFilter } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

const getStatusColor = (T, s) => ({
  sent:     T.green,
  buffered: T.amber,
  dropped:  T.red,
  delayed:  T.amber,
}[s] || T.muted)

const getStatusLabel = (s, qos) => ({
  sent: `QoS ${qos}`,
  buffered: 'BUFFERED',
  dropped: 'DROPPED',
  delayed: 'DELAYED',
}[s] || (s || '').toUpperCase())

const getPriorityColor = (T, p) => ({
  CRITICAL: T.red,
  IMPORTANT: T.amber,
  ROUTINE: T.blue,
}[p] || T.muted)

const getStateTextColor = (T, state) => ({
  GOOD: T.green,
  WEAK: T.amber,
  POOR: T.coral,
  OFFLINE: T.red,
}[state] || T.muted)

export default function MessageLog({ messages, networkState }) {
  const { T } = useTheme()

  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      border: `1px solid ${T.border}`, borderRadius: 18,
      boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '0.9rem 1.1rem', borderBottom: `1px solid ${T.line}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={17} color={T.tealMid} />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: T.textPrimary, textTransform: 'uppercase', letterSpacing: '0.1em' }}>SAAMP Live Log</span>
        </div>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: `${T.green}1a`, border: `1px solid ${T.green}55`,
          borderRadius: 999, padding: '3px 10px', fontSize: '0.62rem', fontWeight: 800,
          color: T.green, letterSpacing: '0.08em',
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.green}`, animation: 'pulse 2s infinite' }} />
          LIVE · {messages.length} MSG
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '70px 110px 110px 90px 1fr 90px', gap: 12, padding: '0.6rem 1.1rem', borderBottom: `1px solid ${T.line}`, fontSize: '0.62rem', fontWeight: 800, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        <span>Time</span>
        <span>Source</span>
        <span>Action</span>
        <span>Priority</span>
        <span>Topic</span>
        <span style={{ textAlign: 'right' }}>Status</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem 1.1rem 1rem', minHeight: 300 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 0', color: T.muted }}>
            <ListFilter size={40} style={{ opacity: 0.4 }} />
            <p style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 10 }}>Awaiting Traffic</p>
            <p style={{ fontSize: '0.78rem', opacity: 0.75 }}>Monitoring MQTT broker for messages</p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg, i) => {
              const sl = getStatusLabel(msg.status, msg.qos_assigned || msg.qos)
              const timeStr = msg.time || (msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '—')
              const statusColor = getStatusColor(T, msg.status)
              const priorityColor = getPriorityColor(T, msg.priority)
              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    display: 'grid', gridTemplateColumns: '70px 110px 110px 90px 1fr 90px', gap: 12,
                    padding: '0.55rem 0', borderBottom: `1px solid ${T.line}`,
                    alignItems: 'center', fontSize: '0.78rem',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: T.muted }}>{timeStr.slice(-8, -3)}</span>
                  <span style={{ fontWeight: 700, color: T.textPrimary, textTransform: 'capitalize' }}>{msg.source || msg.source_type || '—'}</span>
                  <span style={{ color: T.muted, textTransform: 'capitalize' }}>{(msg.action || '').replace(/_/g, ' ')}</span>
                  <div>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800,
                      background: `${priorityColor}1a`, border: `1px solid ${priorityColor}55`, color: priorityColor,
                      letterSpacing: '0.06em',
                    }}>{(msg.priority || '').slice(0, 4)}</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={msg.topic}>{msg.topic || '—'}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.6rem', fontWeight: 800,
                      background: `${statusColor}1a`, border: `1px solid ${statusColor}55`, color: statusColor,
                      letterSpacing: '0.06em',
                    }}>{sl}</span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 1.1rem', borderTop: `1px solid ${T.line}`, fontSize: '0.75rem', fontWeight: 600, color: T.muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} /> SAAMP active classification mode
        </span>
        <span>
          Current State: <span style={{ fontWeight: 800, color: getStateTextColor(T, networkState) }}>{networkState}</span>
        </span>
      </div>
    </div>
  )
}