import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'

import { queryClient } from './queryClient'
import { refreshPlayer, usePlayer, useWeeks } from './queries'
import { readLandComms, readLandPayouts } from './tables'

const MIN = 60_000

export const useLandComms = (account: string | null) =>
  useQuery({ queryKey: ['vault', 'landComms', account], queryFn: () => readLandComms(account!), enabled: !!account, staleTime: MIN, refetchInterval: MIN })

/** DTAL: the daily payout for owning Alien Worlds land. */
export const useLandPayouts = (account: string | null) =>
  useQuery({ queryKey: ['vault', 'payouts', account], queryFn: () => readLandPayouts(account!), enabled: !!account, staleTime: MIN, refetchInterval: MIN })

/** Finished weeks the player can still claim, and what they are worth together. */
export function useClaimableWeeks() {
  const player = usePlayer()
  const { weeks } = useWeeks()

  return useMemo(() => {
    const now = Date.now()
    return player.weeklies.reduce(
      (acc, weekly) => {
        const week = weekly.week ?? weeks.find((w) => w.week_id === weekly.week?.week_id)
        if (!week || weekly.total_quest_points <= 0) return acc
        const ended = now > +chainDate(week.end_date)
        if (!ended || now >= weekly.expiresAt) return acc
        const tlm =
          week.total_quest_points > 0
            ? (tlmToNumber(week.initial_prize_pool) * weekly.total_quest_points) / week.total_quest_points
            : 0
        return { total: acc.total + tlm, weekIds: [...acc.weekIds, week.week_id] }
      },
      { total: 0, weekIds: [] as number[] }
    )
  }, [player.weeklies, weeks])
}

export function refreshVault(account: string | null) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: ['vault'] }), refreshPlayer(account)])
}
