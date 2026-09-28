import { useCallback, useEffect, useState } from 'react'

/**
 * Loads admin data and reloads it on demand.
 *
 * - `deps` works like an effect's dependency list: change a filter and it
 *   refetches.
 * - A reload keeps showing the previous data (the page dims it) instead of
 *   flashing back to an empty skeleton.
 * - Each response is tagged with the request it answers, and anything that
 *   arrives after a newer request has started is thrown away. Without that,
 *   clicking through filters quickly could let a slow, older response land
 *   last and show results for a filter that is no longer selected.
 */
export function useAdminResource(loader, deps = []) {
  const [nonce, setNonce] = useState(0)
  const key = JSON.stringify([...deps, nonce])
  const [result, setResult] = useState({ key: null, data: null, error: '' })

  useEffect(() => {
    let current = true
    loader().then(
      (data) => { if (current) setResult({ key, data, error: '' }) },
      (err) => {
        if (current) setResult((r) => ({ key, data: r.data, error: err.message || 'Could not load this data.' }))
      },
    )
    return () => { current = false }
    // `loader` is recreated every render; `key` already captures everything
    // that should trigger a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const loading = result.key !== key
  return {
    data: result.data,
    error: loading ? '' : result.error,
    loading,
    reload,
  }
}
