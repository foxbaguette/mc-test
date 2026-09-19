import { HISTORY_NODES } from './config'

/*
 * Reads from the Hyperion history nodes. Unlike the RPC pool these are few and slow to rank:
 * paged reads use one node at a time in order, single lookups ask every node at once.
 */

const DEFAULT_TIMEOUT_MS = 20_000

export interface HistoryAction<D> {
  global_sequence: number
  trx_id: string
  /** UTC without a zone marker; see historyTime. */
  timestamp: string
  act: { account: string; name: string; data: D }
}

export interface ActionsPage<D> {
  total: number
  actions: HistoryAction<D>[]
}

/** Hyperion timestamps are UTC but carry no zone suffix. */
export const historyTime = (timestamp: string) => +new Date(`${timestamp}Z`)

type Params = Record<string, string | number | undefined>

async function getJson<T>(node: string, path: string, params: Params, signal: AbortSignal): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value))
  const res = await fetch(`${node}${path}?${query}`, { signal })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${node}`)
  return (await res.json()) as T
}

/** Aborts on the caller's signal (e.g. React Query cancelling a read nobody needs) or after `ms`. */
async function withTimeout<T>(ms: number, signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController()
  const abort = () => controller.abort(signal?.reason)
  const timer = setTimeout(() => controller.abort(new Error('Timed out')), ms)
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/** One page of `get_actions` from one node. Throws when the node's answer has no action list. */
export async function getActions<D>(
  node: string,
  params: Params,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<ActionsPage<D>> {
  const json = await withTimeout(timeoutMs, signal, (combined) =>
    getJson<{ total?: { value: number }; actions?: HistoryAction<D>[] }>(node, '/v2/history/get_actions', params, combined)
  )
  if (!Array.isArray(json.actions)) throw new Error(`No actions from ${node}`)
  return { total: json.total?.value ?? json.actions.length, actions: json.actions }
}

/**
 * Runs a multi-request read against one node at a time, moving to the next node if any
 * request fails, so every page of one read comes from the same node's index. A cancelled
 * read stops instead of starting over on the next node.
 */
export async function withHistoryNode<T>(run: (node: string) => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: unknown = new Error('No history nodes configured')
  for (const node of HISTORY_NODES) {
    signal?.throwIfAborted()
    try {
      return await run(node)
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
    }
  }
  throw lastError
}

/**
 * A transaction's actions from whichever node first answers with actions that pass `accept` (a
 * node that hasn't indexed the transaction yet answers without them). Every node is asked at
 * once, so a slow or dead node costs nothing. Null once all have answered or `timeoutMs` passed.
 */
export function getTransaction<D>(
  id: string,
  accept: (actions: HistoryAction<D>[]) => boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<HistoryAction<D>[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  return new Promise<HistoryAction<D>[] | null>((resolve) => {
    let pending = HISTORY_NODES.length
    for (const node of HISTORY_NODES) {
      getJson<{ actions?: HistoryAction<D>[] }>(node, '/v2/history/get_transaction', { id }, controller.signal)
        .then((json) => {
          if (json.actions && accept(json.actions)) resolve(json.actions)
        })
        .catch(() => undefined)
        .finally(() => {
          if (--pending === 0) resolve(null)
        })
    }
  }).finally(() => {
    // The first good answer settles it: stop the requests still running.
    clearTimeout(timer)
    controller.abort()
  })
}
