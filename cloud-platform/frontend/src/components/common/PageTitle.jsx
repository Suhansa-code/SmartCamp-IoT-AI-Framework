'use client'

import { P } from '@/components/alert/alertPalette'

// Shared page title row — eyebrow · title · subtitle on the left, arbitrary
// actions on the right. Mirrors the alert-page title strip used across pages.
//
// Props:
//   eyebrow    string|node — optional small teal uppercase label above the title
//   title      string|node — the page <h1>
//   subtitle   string|node — muted description line under the title
//   right      node        — actions/chips rendered on the right (optional)
//   align      'flex-end' (default) | 'flex-start' — vertical alignment of the row
//   style      object      — extra styles for the row container
export default function PageTitle({ eyebrow, title, subtitle, right, align = 'flex-end', style }) {
  return (
    <div style={{ display: 'flex', alignItems: align, justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, ...style }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: P.teal, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontFamily: "'Inter',sans-serif", fontSize: '1.5rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em', color: P.ink, lineHeight: 1.2 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: P.muted, fontSize: '0.82rem', marginTop: 4, fontWeight: 400, margin: 0 }}>
            {subtitle}
          </p>
        )}
      </div>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{right}</div>}
    </div>
  )
}
