import React from 'react'
import { Loader2 } from 'lucide-react'
import { COLORS } from '../../../lib/tokens'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors outline-none disabled:opacity-40 disabled:cursor-not-allowed'

const VARIANT_STYLE = {
  primary: { backgroundColor: COLORS.brand, color: '#fff' },
  secondary: { backgroundColor: 'transparent', color: COLORS.body, border: `1px solid ${COLORS.line}` },
  danger: { backgroundColor: COLORS.dangerSoft, color: COLORS.danger, border: `1px solid ${COLORS.line}` },
}

const sizes = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-4 py-2 text-[12.5px]',
  lg: 'px-5 py-2.5 text-[13px]',
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  className = '',
  children,
  disabled,
  style,
  ...props
}) {
  const classes = [base, sizes[size] || sizes.md, className].filter(Boolean).join(' ')
  const variantStyle = VARIANT_STYLE[variant] || VARIANT_STYLE.primary

  return (
    <button
      className={classes}
      style={{ ...variantStyle, ...style }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

export default Button
