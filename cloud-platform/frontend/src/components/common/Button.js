'use client'

import Link from 'next/link'
import { useTheme } from './ThemeProvider'

const INK = '#0F172A'
const GREEN = 'rgb(22, 163, 74)'

// Shared action-button component.
//
// Variants:
//   'green'          (default) — green pill with white text, optional trailing circle icon
//   'outline'                  — pill with border, secondary actions (cd-toolbtn style)
//   'danger'                   — red pill with white text
//   'teal'                     — teal pill with white text
//   'ghost'                    — transparent pill with text, no background
//   'circle'                   — solid round icon button
//   'circleOutline'            — round icon button with border
//   'circleRefresh'            — search-bar style refresh circle button
//
// All pill variants share a consistent ~36px height.
export default function Button({
  children,
  onClick,
  href,
  icon,
  circleIcon = true,
  variant = 'green',
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
            background: dark ? '#FFFFFF' : '#FFFFFF',
            color: dark ? INK : INK,
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

  const isCircle = variant === 'circle' || variant === 'circleOutline' || variant === 'circleRefresh'

  const variantBg = {
    green: GREEN,
    outline: 'transparent',
    danger: T.red,
    teal: T.teal,
    ghost: 'transparent',
    circle: dark ? T.bar : INK,
    circleOutline: dark ? T.card : '#FFFFFF',
    circleRefresh: dark ? '#FFFFFF' : INK,
  }

  const variantBorder = {
    green: 'none',
    outline: `1px solid ${T.border}`,
    danger: 'none',
    teal: 'none',
    ghost: 'none',
    circle: 'none',
    circleOutline: `1px solid ${T.border}`,
    circleRefresh: 'none',
  }

  const variantColor = {
    green: '#FFFFFF',
    outline: T.textPrimary,
    danger: '#FFFFFF',
    teal: '#FFFFFF',
    ghost: T.muted,
    circle: T.textPrimary,
    circleOutline: T.textPrimary,
    circleRefresh: dark ? INK : '#FFFFFF',
  }

  const base = isCircle
    ? {
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        background: variantBg[variant],
        border: variantBorder[variant],
        color: variantColor[variant],
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
        background: variantBg[variant],
        color: variantColor[variant],
        borderRadius: '9999px',
        border: variantBorder[variant],
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
    <button onClick={disabled ? undefined : onClick} style={base} disabled={disabled} suppressHydrationWarning {...rest}>
      {inner}
    </button>
  )
}
