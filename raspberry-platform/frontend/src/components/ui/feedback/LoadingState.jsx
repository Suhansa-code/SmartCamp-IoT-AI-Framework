import { motion } from 'framer-motion'

const sizeMap = {
  sm: { ring: 'w-5 h-5 border-2', text: 'text-xs', gap: 'gap-2' },
  md: { ring: 'w-8 h-8 border-[3px]', text: 'text-sm', gap: 'gap-3' },
  lg: { ring: 'w-12 h-12 border-4', text: 'text-base', gap: 'gap-4' },
}

export default function LoadingState({
  message = 'Loading...',
  size = 'md',
  fullPage = false,
  className = '',
}) {
  const s = sizeMap[size] || sizeMap.md

  const spinner = (
    <div className={`flex flex-col items-center justify-center max-w-7xl mx-auto sm:px-6 sm:py-8 ${s.gap} ${className}`}>
      <div className={`${s.ring} border-teal-500 border-t-transparent rounded-full animate-spin`} />
      {message && <span className={`${s.text} text-slate-500 font-medium`}>{message}</span>}
    </div>
  )

  if (fullPage) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center h-64"
      >
        {spinner}
      </motion.div>
    )
  }

  return spinner
}
