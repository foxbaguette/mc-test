import { useSyncExternalStore } from 'react'
import type { Query } from '@tanstack/react-query'

import { queryClient } from '@/data/queryClient'

import './LoadError.css'

const cache = queryClient.getQueryCache()
const subscribe = (onChange: () => void) => cache.subscribe(onChange)

/**
 * Data a screen is showing right now that never arrived: without it, amounts and lists would
 * render as zero or empty, which reads as real data. Queries whose page shows its own error, or
 * whose failure loses nothing, opt out with `meta: { silentError: true }`.
 */
const isMissing = (query: Query) => query.state.status === 'error' && query.state.data === undefined && !query.meta?.silentError

const failedCount = () => cache.findAll({ type: 'active', predicate: isMissing }).length
const retrying = () =>
  cache.findAll({ type: 'active', predicate: isMissing }).some((query) => query.state.fetchStatus === 'fetching')

/** Stays up until every failed read on the screen has loaded, so a zero is never mistaken for a balance. */
export function LoadError() {
  const failed = useSyncExternalStore(subscribe, failedCount)
  const busy = useSyncExternalStore(subscribe, retrying)
  if (failed === 0) return null

  return (
    <div className="load-error" role="alert">
      <span className="load-error__text">Some data could not be loaded</span>
      <button
        type="button"
        className="load-error__retry"
        disabled={busy}
        onClick={() => void queryClient.refetchQueries({ type: 'active', predicate: isMissing })}
      >
        {busy ? 'Loading…' : 'Try again'}
      </button>
    </div>
  )
}
