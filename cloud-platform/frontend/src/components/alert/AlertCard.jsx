'use client'

import { useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { P, STATUS_COLOR } from './alertPalette'
import SeverityBadge from './SeverityBadge'
import ScoreSparkline from './ScoreSparkline'
import { daysSince } from '@/components/common/utils'

export default function AlertCard({ alert, onAction, highlighted }) {
  const [actionLoading, setActionLoading] = useState(null)
  const borderColor = STATUS_COLOR[alert.status] ?? P.amber

  async function doAction(action) {
    setActionLoading(action)
    try {
      const endpoint = `/api/alerts/${alert.id}/resolve`
      const body = action === 'escalate' ? { notes: 'Escalated by admin' } : { notes: 'Reviewed by admin' }
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) onAction(alert.id, action)
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const statusLabel = {
    pending:   { color: P.amber,  label: '● Pending' },
    resolved:  { color: P.teal,   label: '● Resolved' },
    escalated: { color: P.purple, label: '● Escalated' },
  }[alert.status] ?? { color: P.muted, label: '● Unknown' }

  return (
    <div id={`alert-${alert.id}`} style={{
      background: P.card,
      border: `1px solid ${P.border}`,
      borderRadius: '1.25rem',
      borderLeft: `6px solid ${borderColor}`,
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      boxShadow: highlighted ? `0 0 0 3px ${P.lime}, 0 8px 28px rgba(20,23,26,0.12)` : '0 4px 18px rgba(20,23,26,0.06)',
      transition: 'box-shadow 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>{alert.childId}</span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p style={{ fontSize: '0.8rem', color: P.muted, marginTop: '2px', fontWeight: 600 }}>
            {alert.campName}
          </p>
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: statusLabel.color }}>
          {statusLabel.label}
        </span>
      </div>

      <div style={{
        background: P.cardSoft, borderRadius: '0.75rem', padding: '0.6rem 1rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: P.ink }}>{alert.alertType}</span>
        <span style={{ fontSize: '0.75rem', color: P.muted, fontWeight: 600 }}>{daysSince(alert.triggeredAt)}</span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: P.muted, fontWeight: 600 }}>Last 5 sessions</span>
          <span style={{ fontSize: '0.72rem', color: P.muted, fontWeight: 600 }}>Score →</span>
        </div>
        <ScoreSparkline scores={alert.scores} />
      </div>

      {alert.status !== 'resolved' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => doAction('review')}
            disabled={!!actionLoading}
            style={{
              flex: 1, minHeight: '44px', background: P.lime, color: P.dark,
              borderRadius: '0.75rem', border: 'none', fontWeight: 800, fontSize: '0.84rem',
              cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading === 'review' ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
            }}
          >
            {actionLoading === 'review' ? '⏳' : <CheckCircle2 size={16} />} Mark Reviewed
          </button>
          {alert.status !== 'escalated' && (
            <button
              onClick={() => doAction('escalate')}
              disabled={!!actionLoading}
              style={{
                flex: 1, minHeight: '44px', background: 'transparent', color: P.ink,
                borderRadius: '0.75rem', border: `2px solid ${P.dark}`, fontWeight: 800, fontSize: '0.84rem',
                cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading === 'escalate' ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              }}
            >
              {actionLoading === 'escalate' ? '⏳' : <TriangleAlert size={16} />} Escalate
            </button>
          )}
        </div>
      )}
    </div>
  )
}