import { HISTORY_NODES } from './config'

/*
 * Reads from the Hyperion history nodes. Unlike the RPC pool these are few and slow to
 * rank, so they are simply tried in order: the first node that answers with usable data wins.
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

async function getJson<T>(node: string, path: string, params: Params, timeoutMs: number): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value))
  const res = await fetch(`${node}${path}?${query}`, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${node}`)
  return (await res.json()) as T
}

/** One page of `get_actions` from one node. Throws when the node's answer has no action list. */
export async function getActions<D>(node: string, params: Params, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ActionsPage<D>> {
  const json = await getJson<{ total?: { value: number }; actions?: HistoryAction<D>[] }>(
    node,
    '/v2/history/get_actions',
    params,
    timeoutMs
  )
  if (!Array.isArray(json.actions)) throw new Error(`No actions from ${node}`)
  return { total: json.total?.value ?? json.actions.length, actions: json.actions }
}

/**
 * Runs a multi-request read against one node at a time, moving to the next node if any
 * request fails, so every page of one read comes from the same node's index.
 */
export async function withHistoryNode<T>(run: (node: string) => Promise<T>): Promise<T> {
  let lastError: unknown = new Error('No history nodes configured')
  for (const node of HISTORY_NODES) {
    try {
      return await run(node)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

/**
 * A transaction's actions from the first node whose answer passes `accept` — a node that
 * hasn't indexed the transaction yet answers without the actions being looked for.
 */
export async function getTransaction<D>(
  id: string,
  accept: (actions: HistoryAction<D>[]) => boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<HistoryAction<D>[] | null> {
  for (const node of HISTORY_NODES) {
    try {
      const json = await getJson<{ actions?: HistoryAction<D>[] }>(node, '/v2/history/get_transaction', { id }, timeoutMs)
      if (json.actions && accept(json.actions)) return json.actions
    } catch {
      /* try the next history node */
    }
  }
  return null
}
