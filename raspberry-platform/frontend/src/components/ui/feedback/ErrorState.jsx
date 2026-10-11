import { AlertTriangle } from 'lucide-react'
import { COLORS } from '../../../lib/tokens'
import Button from '../base/Button'

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryText = 'Retry',
  className = '',
}) {
  return (
    <div className={`p-6 text-center max-w-7xl mx-auto ${className}`}>
      <AlertTriangle className="w-6 h-6 mx-auto mb-2" style={{ color: COLORS.danger }} />
      <p className="font-medium" style={{ color: COLORS.danger }}>{title}</p>
      {message && <p className="text-[13px] mt-1" style={{ color: COLORS.muted }}>{message}</p>}
      {onRetry && (
        <Button variant="danger" onClick={onRetry} className="mt-3">
          {retryText}
        </Button>
      )}
    </div>
  )
}
