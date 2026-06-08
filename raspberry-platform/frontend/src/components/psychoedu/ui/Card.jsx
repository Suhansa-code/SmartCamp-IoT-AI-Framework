// Reusable soft card component

export default function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`bg-white rounded-3xl shadow-md p-6 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
