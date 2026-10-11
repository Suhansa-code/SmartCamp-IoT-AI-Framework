import { COLORS } from '../../../lib/tokens'

export default function Avatar({ name, size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-8 h-8 text-[11px]',
    md: 'w-11 h-11 text-[14px]',
    lg: 'w-16 h-16 text-[18px]',
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-medium shrink-0 ${sizes[size]} ${className}`}
      style={{ backgroundColor: COLORS.brand }}
    >
      {name?.substring(0, 2).toUpperCase()}
    </div>
  )
}
