import { useState, useEffect } from 'react'

export function useApi(url) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(url !== null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [url])

  return { data, loading, error }
}
