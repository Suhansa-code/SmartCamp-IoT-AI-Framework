import { useState, useEffect, useCallback, useRef } from 'react'

export default function usePolling(fetchFn, intervalMs = 30000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  const poll = useCallback(async () => {
    try {
      setLoading(prev => prev || data === null)
      setError(null)
      const result = await fetchFn()
      if (activeRef.current) setData(result)
    } catch (err) {
      if (activeRef.current) setError(err.message)
    } finally {
      if (activeRef.current) setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    activeRef.current = true
    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      activeRef.current = false
      clearInterval(id)
    }
  }, [poll, intervalMs])

  return { data, loading, error, refetch: poll }
}
