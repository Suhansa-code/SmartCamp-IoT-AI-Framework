export default function Avatar({ name, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 sm:w-14 sm:h-14 text-base sm:text-lg',
    lg: 'w-16 h-16 sm:w-20 sm:h-20 text-lg sm:text-xl',
  }

  return (
    <div className={`rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold shrink-0 shadow-md shadow-teal-500/25 ${sizes[size]} ${className}`}>
      {name?.substring(0, 2).toUpperCase()}
    </div>
  )
}
