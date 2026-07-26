// Animated progress bar for task completion

export default function ProgressBar({ value = 0, max = 100, label = '', color = '#0D9488' }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>{label}</span>
          <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
        </div>
      )}
      <div className="w-full rounded-full h-4 bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}