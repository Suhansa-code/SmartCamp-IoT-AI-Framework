'use client'

import { C } from './theme'

// Loading skeleton card used by the alerts + welfare dashboards.
export default function SkeletonCard() {
  return (
    <div style={{
      background: C.navyCard,
      borderRadius: '1rem',
      borderLeft: `6px solid ${C.border}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}>
      {[160, 120, 80, 64].map((w, i) => (
        <div key={i} style={{
          height: i === 3 ? 52 : 14,
          width: `${Math.min(100, (w / 2))}%`,
          background: C.navyLight,
          borderRadius: '9999px',
          animation: 'skeletonPulse 1.5s ease-in-out infinite',
          animationDelay: `${i * 0.15}s`,
        }} />
      ))}
    </div>
  )
}