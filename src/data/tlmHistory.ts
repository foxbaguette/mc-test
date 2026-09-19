import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'

import { getActions, historyTime, withHistoryNode, type HistoryAction } from '@/chain/history'
import { tlmHistoryKeys } from './keys'

/**
 * Every TLM a player received in one calendar month (UTC, chain time), read from the
 * history nodes: incoming `alien.worlds:transfer` actions, grouped by who sent them.
 * Naron Rewards also pays in NAR (`token.worlds`), which counts the same as TLM here.
 */

const PAGE_SIZE = 250

export type TlmSource = 'mc' | 'ale' | 'pdef' | 'naron' | 'aw' | 'other'

/** The account Naron Rewards pays from, in TLM and in NAR. */
const NARON_REWARDS = 'theminergame'

/** What is read: TLM from anyone, NAR only from Naron Rewards (other NAR is swaps, staking and the like). */
const STREAMS: { symbol: string; contract: string; from?: string }[] = [
  { symbol: 'TLM', contract: 'alien.worlds' },
  { symbol: 'NAR', contract: 'token.worlds', from: NARON_REWARDS }
]

export const TLM_SOURCES: { id: TlmSource; label: string; color: string }[] = [
  { id: 'mc', label: 'Mission Control', color: '#00baff' },
  { id: 'ale', label: 'Alien Legends', color: '#ffb800' },
  { id: 'pdef', label: 'Planetary Defense', color: '#ff4f6b' },
  { id: 'naron', label: 'Naron Rewards', color: '#2ff5b1' },
  { id: 'aw', label: 'Alien Worlds', color: '#a78bfa' },
  { id: 'other', label: 'Other', color: '#8a9bb0' }
]

/**
 * Which game a sender pays for. Worked out from a month of payouts on chain:
 * each game pays from its own accounts, most of them under one name suffix.
 */
export function sourceOf(from: string): TlmSource {
  // Treasure hunts are run and shown by Mission Control.
  if (from.endsWith('.mc') || from === 'planetaworld') return 'mc'
  if (from.endsWith('.ale')) return 'ale'
  if (from.endsWith('.pdef') || from === 'magordefense' || from === 'botplanetary') return 'pdef'
  if (from === NARON_REWARDS) return 'naron'
  // Mining (m.federation), land ratings, inflation, staking and teleport refunds, planet DAOs, the Arkhive.
  if (from === 'm.federation' || from === 'federation' || from === 'awlndratings' || /\.(worlds|world|dac|lore)$/.test(from))
    return 'aw'
  return 'other'
}

export interface TlmTransfer {
  id: string
  trxId: string
  at: number
  from: string
  amount: number
  memo: string
  source: TlmSource
}

interface TransferData {
  from: string
  to: string
  amount?: number
  quantity?: string
  symbol?: string
  memo?: string
}

type TransferAction = HistoryAction<TransferData>

/** A month as "YYYY-MM"; boundaries are UTC, like every chain timestamp. */
export const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`

export function monthRange(key: string) {
  const [year, month] = key.split('-').map(Number)
  return { start: Date.UTC(year, month - 1, 1), end: Date.UTC(year, month, 1) }
}

export function shiftMonth(key: string, by: number) {
  const { start } = monthRange(key)
  const date = new Date(start)
  date.setUTCMonth(date.getUTCMonth() + by)
  return monthKey(date)
}

function readPage(
  node: string,
  account: string,
  key: string,
  stream: (typeof STREAMS)[number],
  skip: number,
  signal: AbortSignal
) {
  const { start, end } = monthRange(key)
  return getActions<TransferData>(
    node,
    {
      account,
      filter: `${stream.contract}:transfer`,
      'transfer.to': account,
      'transfer.from': stream.from,
      after: new Date(start).toISOString(),
      before: new Date(end).toISOString(),
      limit: PAGE_SIZE,
      skip,
      // Oldest first: transfers arriving while the month loads land at the end instead of shifting the pages.
      sort: 'asc'
    },
    { signal }
  )
}

const toTransfer = (action: TransferAction): TlmTransfer => {
  const data = action.act.data
  return {
    id: String(action.global_sequence),
    trxId: action.trx_id,
    at: historyTime(action.timestamp),
    from: data.from,
    amount: data.amount ?? Number(data.quantity?.split(' ')[0] ?? 0),
    memo: data.memo ?? '',
    source: sourceOf(data.from)
  }
}

/**
 * The whole month, page by page, reporting progress as it goes. All pages come from the
 * node that answered the first, so the pages line up; the next node is tried if one fails.
 * Cancelled through `signal` when nobody needs the month any more (another month was picked).
 */
function readMonth(account: string, key: string, signal: AbortSignal, onProgress: (loaded: number, total: number) => void) {
  return withHistoryNode(async (node) => {
    // First pages together: their totals size the loading bar for both tokens at once.
    const firsts = await Promise.all(STREAMS.map((stream) => readPage(node, account, key, stream, 0, signal)))
    const totals = firsts.map((first) => first.total)
    const total = totals.reduce((a, b) => a + b, 0)
    const lists = firsts.map((first) => [...first.actions])
    const loaded = () => lists.reduce((sum, list) => sum + list.length, 0)
    onProgress(loaded(), total)

    for (const [i, stream] of STREAMS.entries()) {
      while (lists[i].length < totals[i]) {
        const page = await readPage(node, account, key, stream, lists[i].length, signal)
        if (page.actions.length === 0) break
        lists[i].push(...page.actions)
        onProgress(loaded(), total)
      }
    }

    // Incoming only (no transfers to oneself), the stream's own token, each action once, newest first.
    const seen = new Set<number>()
    return STREAMS.flatMap((stream, i) =>
      lists[i]
        .filter((action) => action.act.data.to === account && action.act.data.from !== account)
        .filter((action) => !action.act.data.symbol || action.act.data.symbol === stream.symbol)
        .filter((action) => (seen.has(action.global_sequence) ? false : (seen.add(action.global_sequence), true)))
        .map(toTransfer)
    ).sort((a, b) => b.at - a.at || Number(b.id) - Number(a.id))
  }, signal)
}

interface Progress {
  loaded: number
  total: number
}

/** Loading progress per account and month, kept outside the component so a remount keeps showing it. */
const useProgress = create<Record<string, Progress>>(() => ({}))
const setProgress = (id: string, progress: Progress) => useProgress.setState({ [id]: progress })

export function useTlmHistory(account: string | null, key: string) {
  const progressId = `${account}:${key}`
  const progress = useProgress((all) => all[progressId] ?? null)

  const query = useQuery({
    queryKey: tlmHistoryKeys.month(account, key),
    enabled: !!account,
    // The page shows its own error with a retry.
    meta: { silentError: true },
    // A past month never changes; the current one is refreshed by hand.
    staleTime: key === monthKey(new Date()) ? 5 * 60_000 : Infinity,
    // Using the signal lets React Query cancel the read once no screen shows this month.
    queryFn: ({ signal }) => {
      setProgress(progressId, { loaded: 0, total: 0 })
      return readMonth(account!, key, signal, (loaded, total) => setProgress(progressId, { loaded, total }))
    }
  })

  // The query object is passed on untouched so the page only re-renders for the fields it reads.
  return { query, progress }
}

/** Totals per source, in the order the sources are listed. */
export function summarize(transfers: TlmTransfer[]) {
  const bySource = new Map<TlmSource, { amount: number; count: number }>(TLM_SOURCES.map((s) => [s.id, { amount: 0, count: 0 }]))
  let total = 0
  for (const transfer of transfers) {
    const entry = bySource.get(transfer.source)!
    entry.amount += transfer.amount
    entry.count++
    total += transfer.amount
  }
  return { total, bySource }
}
