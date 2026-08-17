'use client'

import Link from 'next/link'
import { P } from '@/components/alert/alertPalette'

// Shared action-button component (alert-page "nitec" design language).
//
// Variants:
//   'lime'   (default) — lime pill with dark text, optional trailing circle icon
//   'outline'          — white pill with dark border, used for secondary actions
//   'circle'           — solid dark round icon button
//   'circleOutline'    — white round icon button with border
//
// All pill variants share a consistent ~36px height.
export default function Button({
  children,
  onClick,
  href,
  icon,
  circleIcon = true,
  variant = 'lime',
  size = 38,
  disabled = false,
  style,
  ...rest
}) {
  const inner = (
    <>
      {children}
      {icon && (circleIcon ? (
        <span
          style={{
            width: 26,
            height: 26,
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

  const base = variant === 'circle' || variant === 'circleOutline'
    ? {
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        background: variant === 'circle' ? P.dark : P.card,
        border: variant === 'circle' ? 'none' : `1px solid ${P.border}`,
        color: variant === 'circle' ? '#fff' : P.ink,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.55 : 1,
        transition: 'filter 0.18s ease, opacity 0.18s ease',
        ...style,
      }
    : {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.6rem',
        width: 'fit-content',
        background: variant === 'outline' ? 'transparent' : P.lime,
        color: variant === 'outline' ? P.ink : P.dark,
        borderRadius: '9999px',
        border: variant === 'outline' ? `2px solid ${P.dark}` : 'none',
        fontWeight: 700,
        fontSize: '0.8rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textDecoration: 'none',
        fontFamily: "'Inter', sans-serif",
        padding: icon && circleIcon
          ? '5px 5px 5px 18px'
          : variant === 'outline'
            ? '0.4rem 1.25rem'
            : '0.5rem 1.3rem',
        opacity: disabled ? 0.55 : 1,
        transition: 'filter 0.18s ease, opacity 0.18s ease',
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
    <button onClick={disabled ? undefined : onClick} style={base} disabled={disabled} {...rest}>
      {inner}
    </button>
  )
}
