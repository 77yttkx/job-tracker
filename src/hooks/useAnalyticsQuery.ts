import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseQueryError } from '../services/supabaseError'

export interface AnalyticsQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  errorDetail: string | null
  refresh: () => Promise<void>
}

function describeError(err: unknown): { message: string; detail: string | null } {
  if (err instanceof SupabaseQueryError) {
    const parts = [err.code && `code: ${err.code}`, err.hint && `hint: ${err.hint}`, err.details].filter(Boolean)
    return { message: err.message, detail: parts.length > 0 ? parts.join(' • ') : null }
  }
  if (err instanceof Error) return { message: err.message, detail: null }
  return { message: 'Failed to load this analysis.', detail: null }
}

/**
 * Generic loading/error/data hook for one SQL Analytics Lab card. Each
 * card owns its own instance (independent loading/error state per
 * analysis, per the spec's "include loading, empty, and error states"
 * for each card individually), backed by one `fetcher` call - one of the
 * functions in src/services/analytics.ts.
 *
 * `deps` re-runs the fetch when it changes (e.g. the Application Trend
 * card's week/month toggle).
 */
export function useAnalyticsQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []): AnalyticsQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorDetail(null)
    try {
      const result = await fetcher()
      setData(result)
    } catch (err) {
      const { message, detail } = describeError(err)
      setError(message)
      setErrorDetail(detail)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return useMemo(() => ({ data, loading, error, errorDetail, refresh }), [data, loading, error, errorDetail, refresh])
}
