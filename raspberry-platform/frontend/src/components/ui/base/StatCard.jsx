import { motion } from 'framer-motion'

const colorMap = {
  teal: 'text-teal-600', red: 'text-red-600', blue: 'text-sky-600',
  amber: 'text-amber-600', orange: 'text-orange-500', emerald: 'text-emerald-600',
  indigo: 'text-indigo-600', purple: 'text-violet-600', gray: 'text-slate-500',
}

export default function StatCard({ label, value, icon: Icon, unit, color = 'teal', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all duration-300"
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 bg-gradient-to-br from-teal-500/10 to-sky-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          {Icon && <Icon className={`w-4 h-4 ${colorMap[color] || 'text-teal-600'}`} />}
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight">{value ?? '—'}</span>
          {unit && <span className="text-sm text-slate-400">{unit}</span>}
        </div>
      </div>
    </motion.div>
  )
}
