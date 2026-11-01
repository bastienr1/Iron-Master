import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
  setData: (updater: (prev: T | null) => T | null) => void
}

/**
 * Load once (and on `reload`), keeping the previous data while reloading.
 * `load` is read when the effect runs, so pass `deps` for anything it closes over.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    load()
      .then(d => {
        if (cancelled) return
        setDataState(d)
        setError(null)
        setLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick(t => t + 1), [])
  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(prev => updater(prev)), [])
  return { data, error, loading, reload, setData }
}
