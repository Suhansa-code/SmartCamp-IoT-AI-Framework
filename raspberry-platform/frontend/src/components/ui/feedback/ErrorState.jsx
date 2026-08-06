import { AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import Button from '../base/Button'

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryText = 'Retry',
  className = '',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-red-50 border border-red-200 rounded-2xl p-6 text-center max-w-7xl mx-auto sm:px-6 sm:py-8 ${className}`}
    >
      <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
      <p className="text-red-600 font-semibold">{title}</p>
      {message && <p className="text-red-400 text-sm mt-1">{message}</p>}
      {onRetry && (
        <Button variant="danger" onClick={onRetry} className="mt-3">
          {retryText}
        </Button>
      )}
    </motion.div>
  )
}
