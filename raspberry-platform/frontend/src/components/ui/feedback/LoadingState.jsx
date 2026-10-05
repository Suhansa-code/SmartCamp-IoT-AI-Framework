const sizeMap = {
  sm: { ring: 'w-5 h-5 border-2', text: 'text-xs', gap: 'gap-2' },
  md: { ring: 'w-7 h-7 border-2', text: 'text-[13px]', gap: 'gap-3' },
  lg: { ring: 'w-10 h-10 border-[3px]', text: 'text-sm', gap: 'gap-4' },
}

export default function LoadingState({
  message = 'Loading...',
  size = 'md',
  fullPage = false,
  className = '',
}) {
  const s = sizeMap[size] || sizeMap.md

  const spinner = (
    <div className={`flex flex-col items-center justify-center max-w-7xl mx-auto sm:px-6 sm:py-8 ${s.gap} ${className}`}>
      <div className={`${s.ring} border-brand border-t-transparent rounded-full animate-spin`} style={{ borderColor: 'var(--color-brand)', borderTopColor: 'transparent' }} />
      {message && <span className={`${s.text} font-medium`} style={{ color: 'var(--color-muted)' }}>{message}</span>}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center h-64">
        {spinner}
      </div>
    )
  }

  return spinner
}
