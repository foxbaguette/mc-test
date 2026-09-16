/** Game-wide data every player sees: weeks, quests, levels, settings. */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import { tlmToNumber } from '@/lib/format'
import { chainDate, useRerenderAt } from '@/lib/time'

import * as t from './tables'
import { gameKeys } from './keys'
import type { Week } from './types/game'

const MIN = 60_000
const HOUR = 60 * MIN

/**
 * The week in progress at `now`, its prize pool, and when that answer next changes: the end
 * of the current week, or the start of the next one between weeks.
 */
export function weekState(weeks: Week[], now: number) {
  const currentWeek = weeks.find((w) => +chainDate(w.start_date) <= now && now < +chainDate(w.end_date))
  const nextStart = Math.min(...weeks.map((w) => +chainDate(w.start_date)).filter((start) => start > now))
  const nextBoundary = currentWeek ? +chainDate(currentWeek.end_date) : Number.isFinite(nextStart) ? nextStart : undefined
  return { weeks, currentWeek, prizePool: tlmToNumber(currentWeek?.initial_prize_pool), nextBoundary }
}

/**
 * All weeks, the current one and its prize pool. `query` is the untouched query result: read
 * `query.isLoading` or `query.refetch` from it only where needed, so other callers don't
 * re-render on every background fetch.
 */
export function useWeeks() {
  const query = useQuery({ queryKey: gameKeys.weeks, queryFn: t.readWeeks, staleTime: 10 * MIN })
  const data = query.data
  // Recomputed when the week in progress ends (or the next one starts), not on a clock tick.
  const [boundary, setBoundary] = useState<number | undefined>()
  const rollover = useRerenderAt(boundary)
  const derived = useMemo(
    () => weekState(data ?? [], Date.now()),
    // rollover is the trigger to recompute at the boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, rollover]
  )
  useEffect(() => setBoundary(derived.nextBoundary), [derived.nextBoundary])
  return { weeks: derived.weeks, currentWeek: derived.currentWeek, prizePool: derived.prizePool, query }
}

export const useMissionSettings = () =>
  useQuery({ queryKey: gameKeys.missionSettings, queryFn: t.readMissionSettings, staleTime: HOUR })

export const useQuests = () => useQuery({ queryKey: gameKeys.quests, queryFn: t.readQuests, staleTime: 10 * MIN })

export const useCollectInfo = () => useQuery({ queryKey: gameKeys.collectInfo, queryFn: t.readCollectInfo, staleTime: 20 * MIN })

export const useLevels = () => useQuery({ queryKey: gameKeys.levels, queryFn: t.readLevels, staleTime: 24 * HOUR })

export const useMcSettings = () => useQuery({ queryKey: gameKeys.mcSettings, queryFn: t.readMcSettings, staleTime: HOUR })

export const useTips = () => useQuery({ queryKey: gameKeys.tips, queryFn: t.readTips, staleTime: HOUR })

export function useClaimChances() {
  return useQuery({
    queryKey: gameKeys.claimChances,
    queryFn: t.readClaimChances,
    staleTime: HOUR,
    select: (rows) => [...rows].sort((a, b) => a.order - b.order)
  })
}
