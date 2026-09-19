import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'

import { HISTORY_NODES } from '@/chain/config'
import { getSimpleActions, historyTime, type SimpleAction } from '@/chain/history'
import { getRows } from '@/chain/rpc'
import { shardHistoryKeys } from './keys'
import { monthKey, monthRange } from './tlmHistory'

/**
 * Every Shard a player received through the Alien Worlds points proxy (ptpxy.worlds) in one
 * calendar month (UTC). Games pay Shards with `ptpxy.worlds:addpoints`, signed by the game, so
 * the history nodes never file them under the player: the month's payouts to everyone are read
 * and the player's kept. Regular mining pays Shards directly and is not part of this.
 */

const PROXY = 'ptpxy.worlds'
/** Mission Control's Shard wallet; Alien Legends pays through it too. */
const SHARDS_MC = 'shards.mc'
const PAGE_SIZE = 1000
/** History nodes refuse to skip past 10,000 results, so a window with more is split in two. */
const MAX_RESULTS = 10_000
/** Windows read at once, shared over the nodes: about two per node. */
const PARALLEL = 6
const DAY = 86_400_000
/** How far back windows are read oldest first; eosphere refuses that past 90 days. */
const OLDEST_FIRST_DAYS = 80

export type ShardSource = 'ale' | 'mc' | 'pdef' | 'naron' | 'other'

export const SHARD_SOURCES: { id: ShardSource; label: string; color: string }[] = [
  { id: 'ale', label: 'Alien Legends', color: '#ffb800' },
  { id: 'mc', label: 'Mission Control', color: '#00baff' },
  { id: 'pdef', label: 'Planetary Defense', color: '#ff4f6b' },
  { id: 'naron', label: 'Naron Rewards', color: '#2ff5b1' },
  { id: 'other', label: 'Other', color: '#8a9bb0' }
]

/**
 * Which game a points manager pays for. shards.mc pays for Alien Legends and for Mission Control;
 * the Mission Control payouts are told apart afterwards by the wallet that sent them.
 */
export function sourceOf(manager: string): ShardSource {
  if (manager === SHARDS_MC || manager.endsWith('.ale')) return 'ale'
  // Treasure hunts are run and shown by Mission Control.
  if (manager.endsWith('.mc') || manager === 'planetaworld') return 'mc'
  if (manager.endsWith('.pdef') || manager === 'magordefense' || manager === 'botplanetary') return 'pdef'
  if (manager === 'theminergame') return 'naron'
  return 'other'
}

export interface ShardPayout {
  id: string
  trxId: string
  at: number
  manager: string
  /** Whole Shards: the chain counts tenths. */
  amount: number
  source: ShardSource
}

interface AddPoints {
  points_manager: string
  user: string
  points: number
}

interface SendPoints {
  wallet: string
  user: string
  points: number
}

type Progress = { loaded: number; total: number }

/** Runs the jobs `PARALLEL` at a time until none are left; a running job may queue more. */
function pool(jobs: (() => Promise<void>)[], signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let running = 0
    const pump = () => {
      if (signal.aborted) return reject(signal.reason)
      while (running < PARALLEL && jobs.length > 0) {
        const job = jobs.shift()!
        running++
        job().then(() => {
          running--
          pump()
        }, reject)
      }
      if (running === 0 && jobs.length === 0) resolve()
    }
    pump()
  })
}

/**
 * Every action matching `params` between `start` and `end`, read in windows of `step`. Each
 * window is read whole from one node, so its pages line up; the windows are shared out over
 * `nodes` so no node is asked for everything at once. A window a node fails on (nodes refuse when
 * asked too fast) is read again from the next one, and one too big to page through is split.
 */
async function readRange<D>(
  nodes: string[],
  params: Record<string, string>,
  start: number,
  end: number,
  step: number,
  signal: AbortSignal,
  onPage: (added: number, total: number) => void
) {
  const found: SimpleAction<D>[] = []
  const page = (node: string, from: number, to: number, skip: number) =>
    getSimpleActions<D>(
      node,
      {
        ...params,
        after: new Date(from).toISOString(),
        before: new Date(to).toISOString(),
        limit: PAGE_SIZE,
        skip,
        // Oldest first keeps pages steady while new payouts arrive, but eosphere only reads that way
        // for the last 90 days. Older windows are finished, so newest first reads them just as well.
        sort: from > Date.now() - OLDEST_FIRST_DAYS * DAY ? 'asc' : 'desc'
      },
      { signal }
    )

  const window = (from: number, to: number, first: number) => async () => {
    let lastError: unknown
    for (let attempt = 0; attempt < nodes.length; attempt++) {
      const node = nodes[(first + attempt) % nodes.length]
      const rows: SimpleAction<D>[] = []
      let total = 0
      try {
        const head = await page(node, from, to, 0)
        if (head.total > MAX_RESULTS && to - from > 60_000) {
          const mid = from + Math.floor((to - from) / 2)
          jobs.push(window(from, mid, first), window(mid, to, first + 1))
          return
        }
        total = head.total
        rows.push(...head.actions)
        onPage(head.actions.length, total)
        while (rows.length < total) {
          const next = await page(node, from, to, rows.length)
          if (next.actions.length === 0) break
          rows.push(...next.actions)
          onPage(next.actions.length, 0)
        }
        found.push(...rows)
        return
      } catch (err) {
        if (signal.aborted) throw err
        // Forget what this node gave; the next one reads the window from the start.
        onPage(-rows.length, -total)
        lastError = err
      }
    }
    throw lastError
  }

  const jobs: (() => Promise<void>)[] = []
  for (let from = start, i = 0; from < end; from += step, i++) jobs.push(window(from, Math.min(from + step, end), i))
  await pool(jobs, signal)
  return found
}

/**
 * The history nodes that hold the whole month, for sharing the reads out, fullest first. Some
 * index far less than others; the newest minutes may still be arriving, hence the small margin.
 */
async function fullNodes(start: number, end: number, signal: AbortSignal) {
  const counted = await Promise.all(
    HISTORY_NODES.map((node) =>
      getSimpleActions(
        node,
        {
          account: PROXY,
          filter: `${PROXY}:addpoints`,
          after: new Date(start).toISOString(),
          before: new Date(end).toISOString(),
          limit: 1
        },
        { signal }
      )
        .then((page) => ({ node, total: page.total }))
        .catch(() => ({ node, total: -1 }))
    )
  )
  const best = Math.max(...counted.map((c) => c.total))
  if (best < 0) throw new Error('No history node answered')
  const nodes = counted
    .filter((c) => c.total >= best * 0.995)
    .sort((a, b) => b.total - a.total)
    .map((c) => c.node)
  return { nodes, total: best }
}

/**
 * The transactions in which Mission Control's own wallets paid Shards through shards.mc. Each
 * wallet allowed to pay (shards.mc's `scauth`) signs its payouts, so its history holds them.
 */
async function mcPayouts(nodes: string[], account: string, start: number, end: number, signal: AbortSignal) {
  const wallets = (await getRows<{ wallet: string }>({ code: SHARDS_MC, table: 'scauth' }))
    .map((row) => row.wallet)
    .filter((wallet) => wallet.endsWith('.mc') && wallet !== SHARDS_MC)
  const trx = new Set<string>()
  for (const wallet of wallets) {
    const sent = await readRange<SendPoints>(
      nodes,
      { account: wallet, filter: `${SHARDS_MC}:sendpoints` },
      start,
      end,
      // A wallet pays rarely: the whole month in one window.
      end - start,
      signal,
      () => undefined
    )
    for (const action of sent) if (action.data.user === account) trx.add(action.transaction_id)
  }
  return trx
}

async function readMonth(account: string, key: string, signal: AbortSignal, onProgress: (progress: Progress) => void) {
  const { start } = monthRange(key)
  // The current month stops now: later days have nothing yet.
  const end = Math.min(monthRange(key).end, Date.now())
  if (end <= start) return []

  // The month's size is known before the first page, so the loading bar starts at its full length.
  const { nodes, total } = await fullNodes(start, end, signal)
  let loaded = 0
  onProgress({ loaded, total })
  const actions = await readRange<AddPoints>(
    nodes,
    { account: PROXY, filter: `${PROXY}:addpoints` },
    start,
    end,
    // A few thousand payouts a day: a day per window stays well under the node's limit.
    DAY,
    signal,
    (added) => {
      loaded += added
      // Payouts arriving while the month loads can take it a little past the count.
      onProgress({ loaded: Math.min(loaded, total), total })
    }
  )

  const mine = actions.filter((action) => action.data.user === account)
  const mc = mine.some((action) => action.data.points_manager === SHARDS_MC)
    ? await mcPayouts(nodes, account, start, end, signal)
    : new Set<string>()

  return mine
    .map((action, i) => ({
      id: `${action.transaction_id}:${i}`,
      trxId: action.transaction_id,
      at: historyTime(action.timestamp),
      manager: action.data.points_manager,
      amount: action.data.points / 10,
      source: mc.has(action.transaction_id) ? ('mc' as const) : sourceOf(action.data.points_manager)
    }))
    .sort((a, b) => b.at - a.at)
}

/** Loading progress per account and month, kept outside the component so a remount keeps showing it. */
const useProgress = create<Record<string, Progress>>(() => ({}))

export function useShardHistory(account: string | null, key: string) {
  const progressId = `${account}:${key}`
  const progress = useProgress((all) => all[progressId] ?? null)

  const query = useQuery({
    queryKey: shardHistoryKeys.month(account, key),
    enabled: !!account,
    // The page shows its own error with a retry.
    meta: { silentError: true },
    // A past month never changes; the current one is refreshed by hand.
    staleTime: key === monthKey(new Date()) ? 5 * 60_000 : Infinity,
    queryFn: ({ signal }) =>
      readMonth(account!, key, signal, (next) => useProgress.setState({ [progressId]: next }))
  })

  return { query, progress }
}

/** Totals per source, in the order the sources are listed. */
export function summarize(payouts: ShardPayout[]) {
  const bySource = new Map<ShardSource, { amount: number; count: number }>(
    SHARD_SOURCES.map((s) => [s.id, { amount: 0, count: 0 }])
  )
  let total = 0
  for (const payout of payouts) {
    const entry = bySource.get(payout.source)!
    entry.amount += payout.amount
    entry.count++
    total += payout.amount
  }
  return { total, bySource }
}
