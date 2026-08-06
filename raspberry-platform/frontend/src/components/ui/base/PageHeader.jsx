import { motion } from 'framer-motion'

export default function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-500/25">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-800 tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children && (
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/80 border border-slate-200/80 rounded-full px-3.5 py-1.5 w-fit shadow-sm">
          {children}
        </div>
      )}
    </motion.div>
  )
}
