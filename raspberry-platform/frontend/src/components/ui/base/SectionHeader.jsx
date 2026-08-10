export default function SectionHeader({ icon: Icon, title, subtitle, color = 'teal' }) {
  const colors = {
    teal:    'bg-teal-50 text-teal-600 border-teal-100',
    sky:     'bg-sky-50 text-sky-600 border-sky-100',
    orange:  'bg-orange-50 text-orange-500 border-orange-100',
    indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
    violet:  'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber:   'bg-amber-50 text-amber-600 border-amber-100',
    red:     'bg-red-50 text-red-600 border-red-100',
  }[color] || 'bg-teal-50 text-teal-600 border-teal-100'

  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${colors}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h2 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
