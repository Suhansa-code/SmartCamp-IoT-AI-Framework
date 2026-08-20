import { useTheme } from '@/components/common/ThemeProvider'

// Card shell — reused across the dashboard sections, adapts to light/dark.
export default function DashboardCard({ title, subtitle, right, footer, children, style, bodyStyle }) {
  const { T } = useTheme()
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: '1.25rem',
        padding: '1.1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
        ...style,
      }}
    >
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            {title && <div style={{ fontSize: '0.86rem', fontWeight: 800, color: T.textPrimary }}>{title}</div>}
            {subtitle && <div style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', ...bodyStyle }}>{children}</div>
      {footer}
    </div>
  )
}