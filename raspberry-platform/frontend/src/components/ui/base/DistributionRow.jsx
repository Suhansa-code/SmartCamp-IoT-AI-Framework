export default function DistributionRow({ label, data }) {
  if (!data) return null
  const pct = data.percent ?? 0
  const color = pct >= 85 ? 'bg-teal-600' : pct >= 60 ? 'bg-teal-400' : 'bg-sky-400'

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm font-semibold text-slate-700 w-20">{label}</span>
      <div className="flex-1 mx-3">
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-sm text-slate-500 w-24 text-right">
        {data.served}/{data.served + data.pending}
      </span>
      <span className="text-sm font-semibold w-12 text-right text-teal-700">
        {pct}%
      </span>
    </div>
  )
}
