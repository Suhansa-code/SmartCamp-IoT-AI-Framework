import { COLORS } from '../../../lib/tokens'

export default function Card({ children, className = '', padding = true, as = 'div', ...props }) {
  const Tag = as
  return (
    <Tag
      className={`rounded-xl border ${padding ? 'p-4 sm:p-6' : ''} ${className}`}
      style={{ borderColor: COLORS.line }}
      {...props}
    >
      {children}
    </Tag>
  )
}