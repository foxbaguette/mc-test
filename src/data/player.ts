/** The logged-in player: membership, points, balances and weekly progress. */

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { chainDate } from '@/lib/time'
import { useAccount } from '@/state/session'

import { queryClient } from './queryClient'
import * as t from './tables'
import { useWeeks } from './game'
import type { Week } from './types/game'
import type { UserWeekly } from './types/player'
import { playerKeys } from './keys'

const MIN = 60_000
const HOUR = 60 * MIN

export const useMember = (account: string | null) =>
  useQuery({ queryKey: playerKeys.member(account), queryFn: () => t.readMember(account!), enabled: !!account, staleTime: MIN })

export const useUserPoints = (account: string | null) =>
  useQuery({
    queryKey: playerKeys.userPoints(account),
    queryFn: () => t.readUserPoints(account!),
    enabled: !!account,
    staleTime: MIN
  })

export const useTlmBalance = (account: string | null) =>
  useQuery({ queryKey: playerKeys.tlm(account), queryFn: () => t.readTlmBalance(account!), enabled: !!account, staleTime: MIN })

/** A player who has never signed up in Alien Legends has no row at all. */

export const useAlePlayer = (account: string | null) =>
  useQuery({
    queryKey: playerKeys.alePlayer(account),
    queryFn: () => t.readAlePlayer(account!),
    enabled: !!account,
    staleTime: HOUR
  })

export const usePlayerSupport = (account: string | null) =>
  useQuery({
    queryKey: playerKeys.support(account),
    queryFn: () => t.readPlayerSupport(account!),
    enabled: !!account,
    staleTime: HOUR
  })

export interface WeeklyWithWeek extends UserWeekly {
  week?: Week
  expiresAt: number
}

/** The player's weekly rows with their weeks, and the current one. `query` as in useWeeks. */
export function useUserWeeklies(account: string | null) {
  // currentWeek changes when a week rolls over, which moves the current weekly row too.
  const { weeks, currentWeek } = useWeeks()
  const query = useQuery({
    queryKey: playerKeys.userWeeklies(account),
    queryFn: () => t.readUserWeeklies(account!),
    enabled: !!account,
    staleTime: 5 * MIN
  })
  const data = query.data

  const derived = useMemo(() => {
    const now = Date.now()
    const weeklies: WeeklyWithWeek[] = (data ?? []).map((row) => ({
      ...row,
      week: weeks.find((w) => w.start_date === row.week_start),
      expiresAt: +chainDate(row.week_start) + 5 * 7 * 24 * HOUR
    }))
    const current = weeklies.find((w) => {
      const start = +chainDate(w.week_start)
      return start <= now && now < start + 7 * 24 * HOUR
    })
    return { weeklies, current }
    // currentWeek is the trigger to recompute across the weekly reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, weeks, currentWeek])

  return { ...derived, query }
}

/**
 * The logged-in player's membership only: one query. Prefer this over usePlayer wherever
 * points, balances and weekly progress aren't needed.
 */
export function useMembership() {
  const account = useAccount()
  const member = useMember(account)
  const m = member.data
  const isLoading = member.isLoading

  return useMemo(
    () => ({
      account,
      member: m ?? null,
      isMember: !!m,
      isFullMember: !!m?.member,
      isTrial: !!m?.trial,
      flagged: !!m?.flagged,
      isLoading
    }),
    [account, m, isLoading]
  )
}

/** Everything the header and profile show about the logged-in player. Stable while nothing changes. */
export function usePlayer() {
  const membership = useMembership()
  const { account, member: m } = membership
  const points = useUserPoints(account)
  const tlm = useTlmBalance(account)
  const { weeklies, current } = useUserWeeklies(account)
  const support = usePlayerSupport(account)

  const p = points.data
  const tlmBalance = tlm.data
  const supportRow = support.data
  const pointsLoading = points.isLoading

  return useMemo(() => {
    const mcPoints = (p?.total_points ?? 0) - ((m?.mcp_start ?? 0) + (m?.mcp_used ?? 0)) + (m?.mcp_gained ?? 0)
    return {
      ...membership,
      mcPoints,
      redeemablePoints: (p?.redeemable_points ?? 0) / 10,
      rewardPoints: current?.total_quest_points ?? 0,
      tlm: tlmBalance ?? 0,
      currentWeekly: current,
      weeklies,
      isSupport: !!supportRow?.wallet,
      isLoading: membership.isLoading || pointsLoading
    }
  }, [membership, m, p, current, tlmBalance, weeklies, supportRow, pointsLoading])
}

export function refreshPlayer(account: string | null) {
  if (!account) return Promise.resolve()
  return Promise.all(
    [playerKeys.member(account), playerKeys.userPoints(account), playerKeys.tlm(account), playerKeys.userWeeklies(account)].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey })
    )
  )
}
