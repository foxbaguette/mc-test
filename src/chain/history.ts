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

/** An action in Hyperion's compact form (`simple=true`), under half the size of the full one. */
export interface SimpleAction<D> {
  block: number
  /** UTC without a zone marker; see historyTime. */
  timestamp: string
  contract: string
  action: string
  transaction_id: string
  data: D
}

/** One page of `get_actions` in the compact form, with the exact total rather than a capped one. */
export async function getSimpleActions<D>(
  node: string,
  params: Params,
  { timeoutMs = DEFAULT_TIMEOUT_MS, signal }: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<{ total: number; actions: SimpleAction<D>[] }> {
  const json = await withTimeout(timeoutMs, signal, (combined) =>
    getJson<{ total?: { value: number }; simple_actions?: SimpleAction<D>[] }>(
      node,
      '/v2/history/get_actions',
      { ...params, simple: 'true', track: 'true' },
      combined
    )
  )
  if (!Array.isArray(json.simple_actions)) throw new Error(`No actions from ${node}`)
  return { total: json.total?.value ?? json.simple_actions.length, actions: json.simple_actions }
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

/** One stored version of a table row: the row as it was after a change. */
export interface TableDelta<D> {
  timestamp: string
  present: number
  data: D
}

const DELTA_PAGE = 100

/**
 * Every version of one table row, oldest first, paged from a single node. Hyperion keeps a row's
 * past states, which is how figures the contract only stores as totals can be taken apart.
 */
export function getRowHistory<D>(
  code: string,
  table: string,
  primaryKey: string | number,
  signal?: AbortSignal
): Promise<TableDelta<D>[]> {
  return withHistoryNode(async (node) => {
    const rows: TableDelta<D>[] = []
    for (let skip = 0; skip < 50 * DELTA_PAGE; skip += DELTA_PAGE) {
      const page = await withTimeout(DEFAULT_TIMEOUT_MS, signal, (combined) =>
        getJson<{ deltas?: TableDelta<D>[] }>(
          node,
          '/v2/history/get_deltas',
          { code, scope: code, table, primary_key: primaryKey, sort: 'asc', limit: DELTA_PAGE, skip },
          combined
        )
      )
      if (!Array.isArray(page.deltas)) throw new Error(`No deltas from ${node}`)
      rows.push(...page.deltas)
      if (page.deltas.length < DELTA_PAGE) break
    }
    return rows
  }, signal)
}

/**
 * Every stored change to a whole table (all rows), oldest first. Nodes index history unevenly (one
 * may hold a third of what another does), so each is asked for its count and the fullest is read.
 */
export async function getTableHistory<D>(
  code: string,
  table: string,
  signal?: AbortSignal,
  maxPages = 20
): Promise<(TableDelta<D> & { primary_key: string })[]> {
  type Answer = { total?: { value: number }; deltas?: (TableDelta<D> & { primary_key: string })[] }
  const base = { code, scope: code, table, sort: 'asc', limit: DELTA_PAGE }

  const counted = await Promise.all(
    HISTORY_NODES.map((node) =>
      withTimeout(DEFAULT_TIMEOUT_MS, signal, (combined) =>
        getJson<Answer>(node, '/v2/history/get_deltas', { ...base, limit: 1 }, combined)
      )
        .then((answer) => ({ node, total: answer.total?.value ?? -1 }))
        .catch(() => ({ node, total: -1 }))
    )
  )
  const nodes = counted
    .filter((c) => c.total >= 0)
    .sort((a, b) => b.total - a.total)
    .map((c) => c.node)

  let lastError: unknown = new Error('No history node answered')
  for (const node of nodes) {
    signal?.throwIfAborted()
    try {
      const rows: (TableDelta<D> & { primary_key: string })[] = []
      for (let page = 0; page < maxPages; page++) {
        const answer = await withTimeout(DEFAULT_TIMEOUT_MS, signal, (combined) =>
          getJson<Answer>(node, '/v2/history/get_deltas', { ...base, skip: page * DELTA_PAGE }, combined)
        )
        if (!Array.isArray(answer.deltas)) throw new Error(`No deltas from ${node}`)
        rows.push(...answer.deltas)
        if (answer.deltas.length < DELTA_PAGE) break
      }
      return rows
    } catch (err) {
      if (signal?.aborted) throw err
      lastError = err
    }
  }
  throw lastError
}
