import { useState, useEffect, useCallback, useRef } from 'react'

export default function useFetch(url, { immediate = true, interval = null } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const activeRef = useRef(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (activeRef.current) setData(json)
    } catch (err) {
      if (activeRef.current) setError(err.message)
    } finally {
      if (activeRef.current) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    activeRef.current = true
    if (immediate) fetchData()

    let id = null
    if (interval) id = setInterval(fetchData, interval)

    return () => {
      activeRef.current = false
      if (id) clearInterval(id)
    }
  }, [fetchData, immediate, interval])

  return { data, loading, error, refetch: fetchData }
}
