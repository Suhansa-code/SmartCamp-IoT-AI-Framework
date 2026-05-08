'use client'

import { useRouter } from 'next/navigation'
import AlertBadge from '@/components/psychoedu/ui/AlertBadge'

export default function CampOverview({ camp }) {
  const router = useRouter()
  const alertCount = camp.alerts?.length ?? 0
  const status = alertCount === 0 ? 'clear' : alertCount <= 2 ? 'watch' : 'urgent'

  const statusConfig = {
    clear:  { bg: '#DCFCE7', label: '✅ Clear',  color: '#16A34A' },
    watch:  { bg: '#FEF3C7', label: '👁 Watch',  color: '#D97706' },
    urgent: { bg: '#FEE2E2', label: '🚨 Urgent', color: '#DC2626' },
  }
  const sc = statusConfig[status]

  return (
    <div
      className="card-soft flex flex-col gap-4 cursor-pointer hover:shadow-xl transition-shadow duration-200 active:scale-[0.98]"
      onClick={() => router.push(`/admin/alert?camp=${camp.id}`)}
    >
      {/* Camp header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            className="text-xl font-extrabold"
            style={{ fontFamily: "'Baloo 2', cursive", color: '#1E3A5F' }}
          >
            🏕️ {camp.name}
          </h3>
          <p className="text-sm font-semibold" style={{ color: '#0D9488' }}>
            {camp.location ?? 'Location unknown'} · {camp.code}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: sc.bg, color: sc.color }}
        >
          {sc.label}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Children', labelSi: 'ළමුන්', value: camp.childCount ?? 0, icon: '👦' },
          { label: 'Sessions', labelSi: 'සැසි',  value: camp.sessionCount ?? 0, icon: '📋' },
          { label: 'Alerts',   labelSi: 'ඇඟ.',   value: alertCount, icon: '⚠️' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-2xl p-3 flex flex-col items-center gap-1"
            style={{ background: '#F0F9FF' }}
          >
            <span style={{ fontSize: '22px' }}>{stat.icon}</span>
            <span
              className="text-2xl font-extrabold"
              style={{ color: stat.label === 'Alerts' && alertCount > 0 ? '#DC2626' : '#1E3A5F', fontFamily: "'Baloo 2', cursive" }}
            >
              {stat.value}
            </span>
            <span className="text-xs font-bold" style={{ color: '#0D9488' }}>
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Alert severity breakdown */}
      {alertCount > 0 && (
        <div className="flex gap-2 flex-wrap">
          {camp.alerts?.slice(0, 3).map(a => (
            <AlertBadge key={a.id} severity={a.severity} />
          ))}
          {camp.alerts?.length > 3 && (
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: '#F0F9FF', color: '#1E3A5F' }}
            >
              +{camp.alerts.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Last activity */}
      <p className="text-xs font-semibold" style={{ color: '#1E3A5F', opacity: 0.5 }}>
        Last session: {camp.lastSession ? new Date(camp.lastSession).toLocaleString() : 'No sessions yet'}
      </p>
    </div>
  )
}
