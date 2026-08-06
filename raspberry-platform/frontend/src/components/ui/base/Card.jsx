export default function Card({ children, className = '', padding = true }) {
  return (
    <div className={`bg-white/90 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-[0_1px_4px_0_rgba(0,0,0,0.04)] ${padding ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}
