'use client'

import { useState } from 'react'
import AlertBadge from '@/components/psychoedu/ui/AlertBadge'

export default function AlertCard({ alert, onDismiss }) {
  const [loading,  setLoading]  = useState(false)
  const [actioned, setActioned] = useState(false)

  async function handleAction(action) {
    setLoading(true)
    try {
      await fetch(`/api/alerts/${alert.id}/${action}`, { method: 'POST' })
      setActioned(true)
      setTimeout(() => onDismiss?.(), 700)
    } catch { /* offline — still dismiss visually */ }
    finally { setLoading(false) }
  }

  const FLAG_ICONS = {
    high_rt:         '⏱️',
    commission_error:'🚨',
    low_score:       '📉',
    abrupt_stop:     '🛑',
    repeated_miss:   '🔁',
  }

  const borderColor = alert.severity === 'high' ? '#DC2626'
    : alert.severity === 'medium'               ? '#D97706'
    : '#16A34A'

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '1.25rem',
        borderLeft: `7px solid ${borderColor}`,
        padding: '1.25rem 1.5rem',
        boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        opacity: actioned ? 0 : 1,
        transform: actioned ? 'scale(0.96)' : 'scale(1)',
        transition: 'opacity 0.4s, transform 0.4s',
      }}
    >
      {/* Top: child ID + severity */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'0.5rem' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <span style={{ fontSize:'1.5rem' }}>{FLAG_ICONS[alert.flag] ?? '⚠️'}</span>
            <span style={{ fontFamily:"'Baloo 2',cursive", fontSize:'1.2rem', fontWeight:900, color:'#1E3A5F' }}>
              Child {alert.childId}
            </span>
          </div>
          <p style={{ fontSize:'0.82rem', fontWeight:600, color:'#0D9488', marginTop:'2px' }}>
            🏕️ {alert.campName ?? '—'} · {alert.campCode ?? '—'}
          </p>
        </div>
        <AlertBadge severity={alert.severity} />
      </div>

      {/* Detail box */}
      <div style={{ background:'#F0F9FF', borderRadius:'0.75rem', padding:'0.65rem 1rem' }}>
        <p style={{ fontWeight:600, fontSize:'0.9rem', color:'#1E3A5F' }}>
          {alert.message ?? 'Welfare concern flagged during session.'}
        </p>
        <p style={{ fontSize:'0.75rem', marginTop:'3px', color:'#0D9488', fontWeight:600 }}>
          Flag: <strong>{alert.flag ?? 'unknown'}</strong>
          {' · '}
          {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just now'}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
        <button
          onClick={() => handleAction('acknowledge')}
          disabled={loading}
          style={{
            flex:1, minHeight:'44px',
            background:'#CCFBF1', color:'#0D9488',
            borderRadius:'0.75rem', border:'none',
            fontWeight:700, fontSize:'0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition:'transform 0.1s',
          }}
          onPointerDown={e => e.currentTarget.style.transform='scale(0.96)'}
          onPointerUp={e => e.currentTarget.style.transform='scale(1)'}
        >
          ✅ Acknowledge
        </button>
        <button
          onClick={() => handleAction('escalate')}
          disabled={loading}
          style={{
            flex:1, minHeight:'44px',
            background:'#FEE2E2', color:'#DC2626',
            borderRadius:'0.75rem', border:'none',
            fontWeight:700, fontSize:'0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          🔺 Escalate
        </button>
        <button
          onClick={() => handleAction('resolve')}
          disabled={loading}
          style={{
            flex:1, minHeight:'44px',
            background:'white', color:'#1E3A5F',
            borderRadius:'0.75rem', border:'2px solid #E2E8F0',
            fontWeight:700, fontSize:'0.9rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          ✓ Resolve
        </button>
      </div>
    </div>
  )
}
