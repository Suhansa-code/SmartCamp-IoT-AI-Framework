import { Search } from 'lucide-react'
import { COLORS } from '../../../lib/tokens'

export default function SearchInput({ value, onChange, onClear, placeholder, searching, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
        <Search className={`w-4 h-4 transition-colors ${searching ? 'animate-pulse' : ''}`} style={{ color: searching ? COLORS.brand : COLORS.muted }} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-[13px]"
        style={{ backgroundColor: COLORS.grid, borderColor: COLORS.line, color: COLORS.ink }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-3 flex items-center"
          style={{ color: COLORS.muted }}
          aria-label="Clear search"
        >
          <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px]" style={{ backgroundColor: COLORS.hairline, color: COLORS.body }}>×</span>
        </button>
      )}
    </div>
  )
}
