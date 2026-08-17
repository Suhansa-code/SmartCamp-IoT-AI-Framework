'use client'

import Link from 'next/link'
import { P } from '@/components/alert/alertPalette'

// Alert-page primary button — lime pill with dark text and optional trailing
// circular icon. Variant "circle" renders the dark round icon button used for
// refresh actions across pages.
export default function Button({
  children,
  onClick,
  href,
  icon,
  circleIcon = true,
  variant = 'lime',
  size = 38,
  style,
  ...rest
}) {
  const inner = (
    <>
      {children}
      {icon && (circleIcon ? (
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: P.dark,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
      ) : (
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      ))}
    </>
  )

  const base = variant === 'circle'
    ? {
        width: size,
        height: size,
        borderRadius: '50%',
        background: P.dark,
        border: 'none',
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        ...style,
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
        width: 'fit-content',
        background: P.lime,
        color: P.dark,
        borderRadius: '9999px',
        border: 'none',
        fontWeight: 800,
        fontSize: '0.84rem',
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: "'Inter', sans-serif",
        padding: icon && circleIcon ? '9px 9px 9px 20px' : '0.7rem 1.5rem',
        transition: 'filter 0.18s ease',
        ...style,
      }

  if (href) {
    return (
      <Link href={href} style={base} {...rest}>
        {inner}
      </Link>
    )
  }
  return (
    <button onClick={onClick} style={base} {...rest}>
      {inner}
    </button>
  )
}