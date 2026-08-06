export default function EmptyState({ icon: Icon, message, className = '' }) {
  if (Icon) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center ${className}`}>
        <Icon className="w-5 h-5 text-slate-300 mx-auto mb-2" />
        <p className="text-xs text-slate-500">{message}</p>
      </div>
    )
  }
  return (
    <p className={`text-sm text-slate-400 text-center py-8 ${className}`}>{message}</p>
  )
}
