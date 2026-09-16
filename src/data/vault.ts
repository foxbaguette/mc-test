import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'

import { queryClient } from './queryClient'
import { refreshPlayer, usePlayer } from './player'
import { useWeeks } from './game'
import { readLandComms, readLandPayouts } from './tables'
import { toolLoaningKeys, vaultKeys } from './keys'

const MIN = 60_000

// The claimable amounts poll themselves (refetchInterval), so the page needs no timer of its own.

export const useLandComms = (account: string | null) =>
  useQuery({
    queryKey: vaultKeys.landComms(account),
    queryFn: () => readLandComms(account!),
    enabled: !!account,
    staleTime: MIN,
    refetchInterval: MIN
  })

/** DTAL: the daily payout for owning Alien Worlds land. */
export const useLandPayouts = (account: string | null) =>
  useQuery({
    queryKey: vaultKeys.payouts(account),
    queryFn: () => readLandPayouts(account!),
    enabled: !!account,
    staleTime: MIN,
    refetchInterval: MIN
  })

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

/** After a claim: the vault amounts, the mining rewards card and the player's balances. */
export function refreshVault(account: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: vaultKeys.all }),
    queryClient.invalidateQueries({ queryKey: toolLoaningKeys.minerClaim(account) }),
    refreshPlayer(account)
  ])
}
