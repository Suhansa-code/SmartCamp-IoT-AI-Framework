import { useEffect } from 'react'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const { navigate } = useRouter()

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/authorize')
    }
  }, [isAuthenticated])

  if (!isAuthenticated) return null

  return children
}
