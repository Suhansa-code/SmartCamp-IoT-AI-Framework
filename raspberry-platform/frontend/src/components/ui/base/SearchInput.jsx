import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, onClear, placeholder, searching, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
        <Search className={`w-4 h-4 transition-colors ${searching ? 'text-teal-500 animate-pulse' : 'text-slate-400'}`} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 transition-all text-sm text-slate-800 placeholder-slate-400"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
          aria-label="Clear search"
        >
          <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">×</span>
        </button>
      )}
    </div>
  )
}
