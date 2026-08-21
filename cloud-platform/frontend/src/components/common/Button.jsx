'use client'

import Link from 'next/link'
import { useTheme } from './ThemeProvider'

const INK = '#0F172A'
const LIME = '#D8F24E'

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
  const { T, mode } = useTheme()
  const dark = mode === 'dark'

  const inner = (
    <>
      {children}
      {icon && (circleIcon ? (
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: INK,
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
        background: variant === 'circle' ? (dark ? T.bar : INK) : (dark ? T.card : '#FFFFFF'),
        border: variant === 'circle' ? 'none' : `1px solid ${T.border}`,
        color: T.textPrimary,
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
        background: variant === 'outline' ? 'transparent' : LIME,
        color: variant === 'outline' ? T.textPrimary : INK,
        borderRadius: '9999px',
        border: variant === 'outline' ? `2px solid ${dark ? T.border : INK}` : 'none',
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
