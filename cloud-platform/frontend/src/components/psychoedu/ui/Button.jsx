// Reusable button component with PAGES theme variants

export default function Button({
  children,
  variant = 'primary',   // 'primary' | 'teal' | 'ghost'
  size = 'md',           // 'sm' | 'md' | 'lg'
  onClick,
  disabled = false,
  className = '',
  ...props
}) {
  const base = 'rounded-3xl font-bold transition-all duration-150 active:scale-95 flex items-center justify-center gap-2 shadow'
  const variants = {
    primary: 'text-white',
    teal:    'text-white',
    ghost:   'bg-white border-2',
  }
  const styles = {
    primary: { background: disabled ? '#FDBA74' : '#F97316', color: 'white' },
    teal:    { background: disabled ? '#99D6D0' : '#0D9488', color: 'white' },
    ghost:   { borderColor: '#0D9488', color: '#0D9488' },
  }
  const sizes = {
    sm: 'text-base py-2 px-5 min-h-[44px]',
    md: 'text-xl py-4 px-8 min-h-[56px]',
    lg: 'text-2xl py-5 px-10 min-h-[72px]',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      style={styles[variant]}
      {...props}
    >
      {children}
    </button>
  )
}
