import { useQuery } from '@tanstack/react-query'
import { Name } from '@wharfkit/session'
import { create } from 'zustand'

import { HISTORY_NODES } from '@/chain/config'
import { getRowBefore, getSimpleActions, historyTime, isResting, type SimpleAction } from '@/chain/history'
import { getRows } from '@/chain/rpc'
import { shardHistoryKeys } from './keys'
import { readEntries, writeEntries } from './shardCache'
import { readUserPoints } from './tables'
import { monthKey, monthRange } from './tlmHistory'

/**
 * Every Shard a player received through the Alien Worlds points proxy (ptpxy.worlds) in one
 * calendar month (UTC). Games pay Shards with `ptpxy.worlds:addpoints`, signed by the game, so
 * the history nodes never file them under the player: each day's payouts to everyone are read
 * and the player's kept. Alien Worlds itself (mining) pays Shards directly and leaves no payout
 * to list, so its share is worked out from the player's lifetime Shard count instead.
 *
 * Days are read newest first and shown as they arrive; every day that is over is kept in the
 * browser (shardCache), so a month is read from the chain once and the current one only for the
 * days it has gained since.
 */

const PROXY = 'ptpxy.worlds'
/** Mission Control's Shard wallet; Alien Legends pays through it too. */
const SHARDS_MC = 'shards.mc'
const PAGE_SIZE = 1000
/** Asking for just over 100 results shows which nodes cap their pages at 100. */
const PAGE_SIZE_PROBE = 101
/** History nodes refuse to skip past 10,000 results, so a window with more is split in two. */
const MAX_RESULTS = 10_000
/** Windows read at once per node; the site-wide limiter paces each node on top of this. */
const PER_NODE = 1
const DAY = 86_400_000
/** How far back windows are read oldest first; eosphere refuses that past 90 days. */
const OLDEST_FIRST_DAYS = 80
/** A day counts as over, and is kept, this long after it ends: the nodes have indexed it by then. */
const SETTLED_MS = 60 * 60_000

export type ShardSource = 'ale' | 'aw' | 'mc' | 'pdef' | 'naron' | 'other'

export const SHARD_SOURCES: { id: ShardSource; label: string; color: string }[] = [
  { id: 'ale', label: 'Alien Legends', color: '#ffb800' },
  { id: 'aw', label: 'Alien Worlds', color: '#a78bfa' },
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

/**
 * What a payout was for, as far as the chain tells. Games other than Alien Legends pay for one
 * thing each; Mission Control and Alien Legends by the wallet that sent the Shards, and pools.ale
 * by the pool its dungeon and arena claims name. Its other payouts are the landowners' share.
 */
const MANAGER_LABELS: Record<string, string> = {
  planetaworld: 'Treasure Hunt',
  magordefense: 'Mission reward',
  theminergame: 'Mining reward'
}

const WALLET_LABELS: Record<string, string> = {
  'emporium.mc': 'Zapp’s task',
  'game.mc': 'Outpost Builder',
  'quests.ale': 'Quest completed',
  'recovery.ale': 'Candle recovery'
}

const POOL_LABELS: Record<string, string> = {
  shrddung: 'Dungeon won',
  shrdarena: 'Arena won',
  shrdarenadom: 'Arena domination',
  shrdquests: 'Quest completed',
  shrdrec: 'Candle recovery',
  shrdlndowner: 'Landowner reward'
}

/** Alien Legends' reward pools; its claims name the pool a payout came from. */
const ALE_POOLS = 'pools.ale'

export interface ShardPayout {
  id: string
  trxId: string
  at: number
  /** What the payout was for, or null where the chain does not tell (or not yet). */
  label: string | null
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

interface ClaimReward {
  player: string
  pool: string
}

type Window = [from: number, to: number]

export interface ShardMonth {
  payouts: ShardPayout[]
  /** Shards Alien Worlds paid directly (mining): no payouts to list, only the amount. */
  direct: number
}

/** What the page can show while a month loads: the payouts found so far, newest days first. */
interface Loading {
  loaded: number
  total: number
  payouts: ShardPayout[]
}

/** "2026-09-19": a UTC day, the unit days are kept under. */
const dayKey = (at: number) => new Date(at).toISOString().slice(0, 10)

/**
 * The player's lifetime Shard count (uspts.worlds `total_points`, in tenths) at a moment. It only
 * ever grows, so where nodes disagree the highest is the one that has seen every change. A moment
 * that is past never changes its count, so it is kept.
 */
async function lifetimePoints(account: string, at: number, signal: AbortSignal) {
  if (at >= Date.now()) return (await readUserPoints(account))?.total_points ?? 0
  const key = `points:${at}`
  const kept = (await readEntries<number>(account, [key])).get(key)
  if (kept !== undefined) return kept
  const { answered, rows } = await getRowBefore<{ total_points: number }>(
    'uspts.worlds',
    'userpoints',
    Name.from(account).value.toString(),
    at,
    signal
  )
  if (answered === 0) throw new Error('No history node answered')
  const points = Math.max(0, ...rows.map((row) => row.total_points))
  if (at < Date.now() - SETTLED_MS) void writeEntries(account, new Map([[key, points]]))
  return points
}

/**
 * How many results each node gives per page. Most give PAGE_SIZE; some cap pages lower and say so
 * when asked for more. Learned while counting a month, and kept for the visit.
 */
const pageSizes = new Map<string, number>()

/** Runs the jobs `parallel` at a time, in order, until none are left; a running job may queue more. */
function pool(jobs: (() => Promise<void>)[], parallel: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    let running = 0
    const pump = () => {
      if (signal.aborted) return reject(signal.reason)
      while (running < parallel && jobs.length > 0) {
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
 * Every action matching `params` in the windows, read in the order given. Each window is read
 * whole from one node, so its pages line up; the windows are shared out over `nodes` so no node is
 * asked for everything at once. A window a node fails on (nodes refuse when asked too fast) is
 * read again from the next one, and one too big to page through is split. Indexes can have gaps
 * on single days even when the month's count looks whole, so the next node counts each window
 * too: a node that holds fewer than another has counted reads it no further. `onWindow` hears of
 * each window once it is complete.
 */
async function readRange<D>(
  nodes: string[],
  params: Record<string, string>,
  windows: Window[],
  signal: AbortSignal,
  onPage: (added: number) => void,
  onWindow?: (rows: SimpleAction<D>[], from: number) => void
) {
  const found: SimpleAction<D>[] = []
  const page = (node: string, from: number, to: number, skip: number, limit = pageSizes.get(node) ?? PAGE_SIZE) =>
    getSimpleActions<D>(
      node,
      {
        ...params,
        after: new Date(from).toISOString(),
        before: new Date(to).toISOString(),
        limit,
        skip,
        // Oldest first keeps pages steady while new payouts arrive, but eosphere only reads that way
        // for the last 90 days. Older windows are finished, so newest first reads them just as well.
        sort: from > Date.now() - OLDEST_FIRST_DAYS * DAY ? 'asc' : 'desc'
      },
      { signal }
    )

  const window = (from: number, to: number, first: number) => async () => {
    let lastError: unknown
    // The most any node has counted for this window so far.
    let best = 0
    // A window reaching the last minutes may still be arriving, so counts there differ a little.
    const slack = to > Date.now() - 10 * 60_000 ? 0.99 : 1
    for (let attempt = 0; attempt < nodes.length; attempt++) {
      const node = nodes[(first + attempt) % nodes.length]
      const checker = nodes.length > 1 ? nodes[(first + attempt + 1) % nodes.length] : null
      const rows: SimpleAction<D>[] = []
      try {
        const [head, counted] = await Promise.all([
          page(node, from, to, 0),
          checker
            ? page(checker, from, to, 0, 1).then(
                (p) => p.total,
                () => 0
              )
            : 0
        ])
        if (head.total > MAX_RESULTS && to - from > 60_000) {
          // Newest half first, like the windows themselves.
          const mid = from + Math.floor((to - from) / 2)
          jobs.unshift(window(mid, to, first), window(from, mid, first + 1))
          return
        }
        best = Math.max(best, counted)
        if (head.total < best * slack) {
          best = Math.max(best, head.total)
          throw new Error(`${node} holds ${head.total} of ${best}`)
        }
        best = Math.max(best, head.total)
        rows.push(...head.actions)
        onPage(head.actions.length)
        while (rows.length < head.total) {
          const next = await page(node, from, to, rows.length)
          // A node that runs dry before its own count (overloaded, or cut off) has not given the
          // whole window: read it again from the next node rather than keep a day with gaps.
          if (next.actions.length === 0) throw new Error(`${node} stopped short of ${head.total}`)
          rows.push(...next.actions)
          onPage(next.actions.length)
        }
        found.push(...rows)
        onWindow?.(rows, from)
        return
      } catch (err) {
        if (signal.aborted) throw err
        // Forget what this node gave; the next one reads the window from the start.
        onPage(-rows.length)
        lastError = err
      }
    }
    throw lastError
  }

  const jobs = windows.map(([from, to], i) => window(from, to, i))
  await pool(jobs, Math.max(1, nodes.length) * PER_NODE, signal)
  return found
}

/**
 * The history nodes that hold everything from `start` to `end`, for sharing the reads out,
 * fullest first, and how many payouts there are. Some index far less than others; the newest
 * minutes may still be arriving, hence the small margin. The count also asks for just over 100
 * results, which tells each node's page size: nodes that cap pages at 100 take ten times the
 * requests, so they only help out when fewer than two others can. That way the read keeps working
 * if the fast nodes go away, only slower.
 */
async function fullNodes(start: number, end: number, signal: AbortSignal) {
  const count = (node: string, limit: number) =>
    getSimpleActions(
      node,
      {
        account: PROXY,
        filter: `${PROXY}:addpoints`,
        after: new Date(start).toISOString(),
        before: new Date(end).toISOString(),
        limit
      },
      { signal }
    ).then((page) => page.total)

  const counted = await Promise.all(
    HISTORY_NODES.filter((node) => !isResting(node)).map(async (node) => {
      try {
        const total = await count(node, PAGE_SIZE_PROBE)
        pageSizes.set(node, PAGE_SIZE)
        return { node, total }
      } catch (err) {
        // "limit too big, maximum: 100": a smaller page size, not a broken node.
        const max = /maximum:\s*(\d+)/.exec(err instanceof Error ? err.message : '')?.[1]
        if (!max) return { node, total: -1 }
        pageSizes.set(node, Number(max))
        return count(node, 1).then(
          (total) => ({ node, total }),
          () => ({ node, total: -1 })
        )
      }
    })
  )
  const best = Math.max(...counted.map((c) => c.total))
  if (best < 0) throw new Error('No history node answered')
  const full = counted.filter((c) => c.total >= best * 0.995).sort((a, b) => b.total - a.total)
  const fast = full.filter((c) => (pageSizes.get(c.node) ?? PAGE_SIZE) >= PAGE_SIZE)
  const nodes = (fast.length >= 2 ? fast : full).map((c) => c.node)
  return { nodes, total: best }
}

/**
 * The wallets worth reading that pay Shards through shards.mc: Mission Control's own and Alien
 * Legends' quest and recovery wallets. Each wallet allowed to pay (shards.mc's `scauth`) signs
 * its payouts, so its history holds them. pools.ale pays thousands a day and is left out.
 */
async function payingWallets() {
  return (await getRows<{ wallet: string }>({ code: SHARDS_MC, table: 'scauth' }))
    .map((row) => row.wallet)
    .filter((wallet) => (wallet.endsWith('.mc') || wallet.endsWith('.ale')) && wallet !== SHARDS_MC && wallet !== ALE_POOLS)
}

/** The shards.mc payouts to the player from `wallets` in the window: the wallet that paid, by transaction. */
async function walletPayouts(
  nodes: string[],
  wallets: string[],
  account: string,
  span: Window,
  signal: AbortSignal,
  onPage: (added: number) => void
) {
  const byTrx = new Map<string, string>()
  for (const wallet of wallets) {
    // A few hundred a day at most: one window, split if it is too big.
    const sent = await readRange<SendPoints>(
      nodes,
      { account: wallet, filter: `${SHARDS_MC}:sendpoints` },
      [span],
      signal,
      onPage
    )
    for (const action of sent) if (action.data.user === account) byTrx.set(action.transaction_id, wallet)
  }
  return byTrx
}

/** The pool each of the player's pools.ale Shard claims (dungeons, arena) came from, by transaction. */
async function poolClaims(nodes: string[], account: string, span: Window, signal: AbortSignal, onPage: (added: number) => void) {
  const claims = await readRange<ClaimReward>(
    nodes,
    { account: ALE_POOLS, filter: `${ALE_POOLS}:claimpreward` },
    [span],
    signal,
    onPage
  )
  const byTrx = new Map<string, string>()
  for (const claim of claims)
    if (claim.data.player === account && claim.data.pool.startsWith('shrd')) byTrx.set(claim.transaction_id, claim.data.pool)
  return byTrx
}

/** Up to this much to read counts as a short read: today, and yesterday until it is kept. */
const SHORT_READ = 2 * DAY
/** How long nodes found whole stay trusted for short reads without counting again. */
const RECOUNT_MS = 10 * 60_000
let recentNodes: { nodes: string[]; at: number } | null = null

/** How many actions match, from one node, for sizing the loading bar. */
const countActions = (node: string, params: Record<string, string>, [start, end]: Window, signal: AbortSignal) =>
  getSimpleActions(
    node,
    { ...params, after: new Date(start).toISOString(), before: new Date(end).toISOString(), limit: 1 },
    { signal }
  )
    .then((page) => page.total)
    .catch(() => 0)

/** The payout as shown, labelled from the wallet or pool that paid it where the chain tells. */
function toPayout(
  action: SimpleAction<AddPoints>,
  wallet: string | undefined,
  pool: string | undefined,
  labelsRead: boolean
): ShardPayout {
  const manager = action.data.points_manager
  const source = wallet?.endsWith('.mc') ? 'mc' : sourceOf(manager)
  let label: string | null = MANAGER_LABELS[manager] ?? (source === 'pdef' ? MANAGER_LABELS.magordefense : null)
  if (manager === SHARDS_MC) {
    if (wallet) label = WALLET_LABELS[wallet] ?? null
    else if (pool) label = POOL_LABELS[pool] ?? null
    // pools.ale's payouts without a claim are the landowners' share; until the wallets and claims
    // are read, there is no telling yet.
    else label = labelsRead ? POOL_LABELS.shrdlndowner : null
  }
  return {
    id: `${action.transaction_id}:${manager}:${action.data.points}`,
    trxId: action.transaction_id,
    at: historyTime(action.timestamp),
    label,
    amount: action.data.points / 10,
    source
  }
}

const newestFirst = (a: ShardPayout, b: ShardPayout) => b.at - a.at

async function readMonth(
  account: string,
  key: string,
  signal: AbortSignal,
  onLoading: (loading: Loading) => void
): Promise<ShardMonth> {
  const { start, end: monthEnd } = monthRange(key)
  // The current month stops now: later days have nothing yet.
  const end = Math.min(monthEnd, Date.now())
  if (end <= start) return { payouts: [], direct: 0 }

  const days: Window[] = []
  for (let from = start; from < end; from += DAY) days.push([from, Math.min(from + DAY, end)])
  days.reverse()
  const settledBefore = Date.now() - SETTLED_MS

  // Days already kept need no reading; the others are read newest first.
  const kept = await readEntries<ShardPayout[]>(
    account,
    days.map(([from]) => dayKey(from))
  )
  const byDay = new Map(kept)
  const missing = days.filter(([from]) => !kept.has(dayKey(from)))
  const shown = () => [...byDay.values()].flat().sort(newestFirst)
  onLoading({ loaded: 0, total: 0, payouts: shown() })

  // Every payout's action as read, for labelling once the wallets and claims are known.
  const read = new Map<string, SimpleAction<AddPoints>[]>()

  if (missing.length > 0) {
    const span: Window = [Math.min(...missing.map(([from]) => from)), Math.max(...missing.map(([, to]) => to))]
    // A short read (today, and yesterday until it is kept) reuses the nodes found whole lately and
    // skips the counting, which only sizes the loading bar; a longer one counts first, so the bar
    // starts at its full length: the payouts, and the wallet payouts and claims that label them.
    const short = span[1] - span[0] <= SHORT_READ
    const reuse =
      short && recentNodes && Date.now() - recentNodes.at < RECOUNT_MS ? recentNodes.nodes.filter((n) => !isResting(n)) : []
    const counted = reuse.length > 0 ? { nodes: reuse, total: 0 } : await fullNodes(span[0], span[1], signal)
    const nodes = counted.nodes
    if (reuse.length === 0) recentNodes = { nodes, at: Date.now() }
    const wallets = await payingWallets()
    const extraCounts = short
      ? []
      : await Promise.all([
          ...wallets.map((wallet) =>
            countActions(nodes[0], { account: wallet, filter: `${SHARDS_MC}:sendpoints` }, span, signal)
          ),
          countActions(nodes[0], { account: ALE_POOLS, filter: `${ALE_POOLS}:claimpreward` }, span, signal)
        ])
    const total = counted.total + extraCounts.reduce((sum, n) => sum + n, 0)
    let loaded = 0
    const report = () => onLoading({ loaded: total > 0 ? Math.min(loaded, total) : loaded, total, payouts: shown() })
    const onPage = (added: number) => {
      loaded += added
      report()
    }
    report()

    // The player's payouts, each once: a node can list an action twice.
    const seen = new Set<string>()
    await readRange<AddPoints>(nodes, { account: PROXY, filter: `${PROXY}:addpoints` }, missing, signal, onPage, (rows, from) => {
      const day = dayKey(from)
      const mine = rows.filter((action) => {
        if (action.data.user !== account) return false
        const id = `${action.transaction_id}:${action.data.points_manager}:${action.data.points}`
        return seen.has(id) ? false : (seen.add(id), true)
      })
      // A day split in parts arrives in parts.
      read.set(day, [...(read.get(day) ?? []), ...mine])
      byDay.set(
        day,
        read.get(day)!.map((action) => toPayout(action, undefined, undefined, false))
      )
      report()
    })

    // Only days paid through shards.mc need the wallets and claims read, one after the other so
    // each node still has one read at a time.
    const labelDays = [...read.entries()].filter(([, actions]) => actions.some((a) => a.data.points_manager === SHARDS_MC))
    let paidBy = new Map<string, string>()
    let pools = new Map<string, string>()
    if (labelDays.length > 0) {
      const froms = labelDays.map(([day]) => Date.parse(`${day}T00:00:00Z`))
      const labelSpan: Window = [Math.max(span[0], Math.min(...froms)), Math.min(span[1], Math.max(...froms) + DAY)]
      paidBy = await walletPayouts(nodes, wallets, account, labelSpan, signal, onPage)
      pools = await poolClaims(nodes, account, labelSpan, signal, onPage)
    }
    const settled = new Map<string, ShardPayout[]>()
    for (const [from, to] of missing) {
      const day = dayKey(from)
      const payouts = (read.get(day) ?? []).map((action) =>
        toPayout(action, paidBy.get(action.transaction_id), pools.get(action.transaction_id), true)
      )
      byDay.set(day, payouts)
      // Days that are over are kept, empty ones too, so they are never read again.
      if (to <= settledBefore && to - from === DAY) settled.set(day, payouts)
    }
    void writeEntries(account, settled)
    loaded = total
    report()
  }

  const payouts = shown()
  // Everything earned in the month, less what came through the proxy, is what Alien Worlds paid.
  const [before, after] = await Promise.all([lifetimePoints(account, start, signal), lifetimePoints(account, monthEnd, signal)])
  const proxied = payouts.reduce((sum, payout) => sum + Math.round(payout.amount * 10), 0)
  const direct = Math.max(0, after - before - proxied) / 10
  return { payouts, direct }
}

/** Loading state per account and month, kept outside the component so a remount keeps showing it. */
const useLoading = create<Record<string, Loading>>(() => ({}))

export function useShardHistory(account: string | null, key: string) {
  const loadingId = `${account}:${key}`
  const loading = useLoading((all) => all[loadingId] ?? null)

  const query = useQuery({
    queryKey: shardHistoryKeys.month(account, key),
    enabled: !!account,
    // The page shows its own error with a retry.
    meta: { silentError: true },
    // A past month never changes. The current one only reads the days it lacks (today, mostly),
    // so it can be fresh after a minute, and the refresh button fetches the latest any time.
    staleTime: key === monthKey(new Date()) ? 60_000 : Infinity,
    // While the current month is open (and the tab visible), new payouts arrive by themselves.
    refetchInterval: key === monthKey(new Date()) ? 60_000 : false,
    queryFn: ({ signal }) => readMonth(account!, key, signal, (next) => useLoading.setState({ [loadingId]: next }))
  })

  return { query, loading }
}

/**
 * Totals per source, in the order the sources are listed, with Alien Worlds' direct Shards
 * (null while they are not known yet).
 */
export function summarize(payouts: ShardPayout[], direct: number | null) {
  const bySource = new Map<ShardSource, { amount: number; count: number }>(
    SHARD_SOURCES.map((s) => [s.id, { amount: 0, count: 0 }])
  )
  bySource.get('aw')!.amount = direct ?? 0
  let total = direct ?? 0
  for (const payout of payouts) {
    const entry = bySource.get(payout.source)!
    entry.amount += payout.amount
    entry.count++
    total += payout.amount
  }
  return { total, bySource }
}
