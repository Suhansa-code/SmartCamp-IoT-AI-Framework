import React from 'react'
import { Loader2 } from 'lucide-react'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all outline-none active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100'

const variants = {
  primary:
    'bg-teal-600 text-white hover:bg-teal-700 shadow-md shadow-teal-600/20 disabled:bg-slate-300 disabled:shadow-none disabled:hover:bg-slate-300',
  secondary:
    'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/20',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2',
  lg: 'px-6 py-2.5',
}

function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  className = '',
  children,
  disabled,
  ...props
}) {
  const classes = [
    base,
    variants[variant] || variants.primary,
    sizes[size] || sizes.md,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

export default Button
