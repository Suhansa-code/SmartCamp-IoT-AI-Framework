'use client'

import { useTheme } from './ThemeProvider'

// Loading skeleton card used by the alerts dashboard.
export default function SkeletonCard() {
  const { T } = useTheme()
  return (
    <div style={{
      background: `linear-gradient(160deg, ${T.card} 0%, ${T.bg} 100%)`,
      borderRadius: '1rem',
      border: `1px solid ${T.border}`,
      borderLeft: `6px solid ${T.border}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {[160, 120, 80, 64].map((w, i) => (
        <div key={i} style={{
          height: i === 3 ? 52 : 14,
          width: `${Math.min(100, (w / 2))}%`,
          background: T.navyLight,
          borderRadius: '9999px',
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}