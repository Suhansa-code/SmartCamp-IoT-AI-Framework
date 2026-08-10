export default function InfoField({ label, icon: Icon, editing, value, children }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1">
        {Icon && <Icon className="w-3 h-3" />}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      {editing ? children : <p className="text-sm font-semibold text-slate-800">{value || '—'}</p>}
    </div>
  )
}
