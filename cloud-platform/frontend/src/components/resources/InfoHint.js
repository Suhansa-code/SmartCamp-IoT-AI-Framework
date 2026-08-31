'use client'

/**
 * A small ⓘ that holds an explanation until it is asked for.
 *
 * The stock page used to state its methodology in paragraphs sitting directly
 * under the numbers they described — a shaded-band explanation under the chart,
 * a provenance essay under the table. Everything was true, and none of it was
 * readable at a glance: an operator wanting to know what to reorder had to skip
 * past four sentences about Theil-Sen residuals to reach the date.
 *
 * The information is not dropped, only moved behind an affordance. Anything a
 * reader needs to ACT stays on the surface; anything they need to TRUST the
 * number lives in here.
 *
 * Never render this inside a container with `overflow: auto` — the bubble is
 * absolutely positioned and will be clipped. Inside the table, use the
 * expandable row instead.
 */
import { useId, useState } from 'react'
import { Info } from 'lucide-react'
import { useTheme } from '@/components/common/ThemeProvider'

/**
 * @param {string} text        the explanation
 * @param {string} [align]     'center' (default) | 'left' | 'right' — horizontal anchor
 * @param {string} [placement] 'top' (default) | 'bottom' — which side the bubble opens on
 * @param {number} [size]      icon size in px
 * @param {number} [width]     bubble width in px
 */
export default function InfoHint({ text, align = 'center', placement = 'top', size = 13, width = 250 }) {
  const { T } = useTheme()
  const [open, setOpen] = useState(false)
  const id = useId()

  if (!text) return null

  // Anchor the bubble so it never runs off the card edge it sits in.
  const anchor =
    align === 'left'  ? { left: 0 }
  : align === 'right' ? { right: 0 }
  : { left: '50%', transform: 'translateX(-50%)' }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label="Explain this"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, margin: 0, border: 'none', background: 'transparent',
          color: open ? T.ink : T.dim, cursor: 'help', lineHeight: 0,
        }}
      >
        <Info size={size} />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: 'absolute',
            // A metric's ⓘ sits under the number it explains, so opening
            // upwards would hide that number behind the bubble.
            ...(placement === 'bottom'
              ? { top: 'calc(100% + 8px)' }
              : { bottom: 'calc(100% + 8px)' }),
            ...anchor,
            width, zIndex: 40, pointerEvents: 'none',
            background: T.mode === 'dark' ? T.cardSoft : T.textPrimary,
            color: T.mode === 'dark' ? T.ink : '#FFFFFF',
            border: `1px solid ${T.mode === 'dark' ? T.border : 'transparent'}`,
            borderRadius: 8, padding: '0.55rem 0.7rem',
            fontSize: '0.72rem', fontWeight: 500, lineHeight: 1.5, textAlign: 'left',
            boxShadow: '0 6px 20px rgba(0,0,0,0.22)', whiteSpace: 'normal',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
