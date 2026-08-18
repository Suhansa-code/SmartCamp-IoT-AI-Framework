import { P } from '@/data/theme.data'

// White "nitec"-style card shell — reused across the dashboard sections.
export default function DashboardCard({ title, subtitle, right, footer, children, style, bodyStyle }) {
  return (
    <div
      style={{
        background: P.panel,
        border: `1px solid ${P.border}`,
        borderRadius: '1.25rem',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        boxShadow: '0 14px 34px rgba(20,30,40,0.06)',
        ...style,
      }}
    >
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontSize: '0.86rem', fontWeight: 800, color: P.ink }}>{title}</div>}
            {subtitle && <div style={{ fontSize: '0.7rem', color: P.muted, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', ...bodyStyle }}>{children}</div>
      {footer}
    </div>
  )
}