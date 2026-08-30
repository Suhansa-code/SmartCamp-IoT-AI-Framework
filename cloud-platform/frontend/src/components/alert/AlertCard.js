'use client'

import { useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'
import { STATUS_COLOR } from '@/data/theme.data'
import SeverityBadge from './SeverityBadge'
import ScoreSparkline from './ScoreSparkline'
import Button from '@/components/common/Button'
import { daysSince } from '@/components/common/utils'
import { API_BASE } from '@/lib/apiBase'

export default function AlertCard({ alert, onAction, highlighted }) {
  const [actionLoading, setActionLoading] = useState(null)
  const { T } = useTheme()
  const borderColor = STATUS_COLOR[alert.status] ?? T.amber

  async function doAction(action) {
    setActionLoading(action)
    try {
      const endpoint = `/api/alerts/${alert.id}/resolve`
      const body = action === 'escalate' ? { notes: 'Escalated by admin' } : { notes: 'Reviewed by admin' }
      const res = await fetch(`${API_BASE}${endpoint}`, {
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
    pending:   { color: T.amber,  label: '● Pending' },
    resolved:  { color: T.teal,   label: '● Resolved' },
    escalated: { color: T.purple, label: '● Escalated' },
  }[alert.status] ?? { color: T.muted, label: '● Unknown' }

  return (
    <div id={`alert-${alert.id}`} style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: '1.25rem',
      padding: '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      transition: 'background 0.2s, border 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: T.textPrimary }}>{alert.childId}</span>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p style={{ fontSize: '0.8rem', color: T.muted, marginTop: '2px', fontWeight: 600 }}>
            {alert.campName}
          </p>
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: statusLabel.color }}>
          {statusLabel.label}
        </span>
      </div>

      <div style={{
        background: T.bar, borderRadius: '0.75rem', padding: '0.6rem 1rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: T.textPrimary }}>{alert.alertType}</span>
        <span style={{ fontSize: '0.75rem', color: T.muted, fontWeight: 600 }}>{daysSince(alert.triggeredAt)}</span>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>Last 5 sessions</span>
          <span style={{ fontSize: '0.72rem', color: T.muted, fontWeight: 600 }}>Score →</span>
        </div>
        <ScoreSparkline scores={alert.scores} />
      </div>

      {alert.status !== 'resolved' && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            onClick={() => doAction('review')}
            disabled={!!actionLoading}
            style={{ flex: 1, minHeight: 36 }}
          >
            {actionLoading === 'review' ? '⏳' : <CheckCircle2 size={16} />} Mark Reviewed
          </Button>
          {alert.status !== 'escalated' && (
            <Button
              variant="outline"
              onClick={() => doAction('escalate')}
              disabled={!!actionLoading}
              style={{ flex: 1, minHeight: 36 }}
            >
              {actionLoading === 'escalate' ? '⏳' : <TriangleAlert size={16} />} Escalate
            </Button>
          )}
        </div>
      )}
    </div>
  )
}