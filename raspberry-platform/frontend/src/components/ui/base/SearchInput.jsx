import { Search } from 'lucide-react'
import { COLORS } from '../../../lib/tokens'

export default function SearchInput({ value, onChange, onClear, placeholder, searching, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
        <Search className={`w-4 h-4 transition-colors ${searching ? 'animate-pulse' : ''}`} style={{ color: searching ? COLORS.brand : COLORS.muted }} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 rounded-lg border focus:outline-none transition-colors text-[13px] font-medium"
        style={{ backgroundColor: '#FAFAF9', borderColor: COLORS.line, color: COLORS.ink }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-3 flex items-center transition-colors"
          style={{ color: COLORS.muted }}
          aria-label="Clear search"
        >
          <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#EFEFEE', color: COLORS.body }}>×</span>
        </button>
      )}
    </div>
  )
}