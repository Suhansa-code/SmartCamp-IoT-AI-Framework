import AlertBadge from '@/components/education/ui/AlertBadge'

export default function CampOverview({ camp, onCampClick, darkMode = false }) {
  const alertCount = camp.alerts?.length ?? 0
  const status = alertCount === 0 ? 'clear' : alertCount <= 2 ? 'watch' : 'urgent'

  const statusConfig = darkMode
    ? {
        clear:  { bg: '#064E3B', label: '✅ Clear',  color: '#6EE7B7' },
        watch:  { bg: '#78350F', label: '👁 Watch',  color: '#FCD34D' },
        urgent: { bg: '#7F1D1D', label: '🚨 Urgent', color: '#FCA5A5' },
      }
    : {
        clear:  { bg: '#DCFCE7', label: '✅ Clear',  color: '#16A34A' },
        watch:  { bg: '#FEF3C7', label: '👁 Watch',  color: '#D97706' },
        urgent: { bg: '#FEE2E2', label: '🚨 Urgent', color: '#DC2626' },
      }
  const sc = statusConfig[status]

  const textColor = darkMode ? '#E2E8F0' : '#1E3A5F'
  const subColor  = darkMode ? '#94A3B8' : '#0D9488'
  const cardBg    = darkMode ? '#1E3A5F' : '#F0F9FF'
  const mutedColor = darkMode ? 'rgba(226,232,240,0.5)' : 'rgba(30,58,95,0.5)'

  return (
    <div
      className="flex flex-col gap-4 cursor-pointer hover:shadow-xl transition-shadow duration-200 active:scale-[0.98]"
      style={{
        background: darkMode ? '#0F2A4A' : 'white',
        borderRadius: '1.25rem',
        padding: '1.25rem',
        border: darkMode ? '1px solid #2D4A70' : '1px solid #E2E8F0',
      }}
      onClick={() => onCampClick?.(camp.id)}
    >
      {/* Camp header */}
      <div className="flex items-start justify-between">
        <div>
          <h3
            className="text-xl font-extrabold"
            style={{ fontFamily: "'Inter', sans-serif", color: textColor }}
          >
            🏕️ {camp.name}
          </h3>
          <p className="text-sm font-semibold" style={{ color: subColor }}>
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
            style={{ background: cardBg }}
          >
            <span style={{ fontSize: '22px' }}>{stat.icon}</span>
            <span
              className="text-2xl font-extrabold"
              style={{ color: stat.label === 'Alerts' && alertCount > 0 ? '#DC2626' : textColor, fontFamily: "'Inter', sans-serif" }}
            >
              {stat.value}
            </span>
            <span className="text-xs font-bold" style={{ color: subColor }}>
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
              style={{ background: cardBg, color: textColor }}
            >
              +{camp.alerts.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Last activity */}
      <p className="text-xs font-semibold" style={{ color: mutedColor }}>
        Last session: {camp.lastSession ? new Date(camp.lastSession).toLocaleString() : 'No sessions yet'}
      </p>
    </div>
  )
}
