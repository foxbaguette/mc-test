import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { queryClient } from './queryClient'
import { refreshPlayer, useMember, useUserPoints } from './queries'
import { readDaoCandidates, readPlanetCandidates, readVoteBlocklist, readVoteHistory, readVotingConfig } from './tables'
import type { CandidateProfile } from './types'

const MIN = 60_000
const HOUR = 60 * MIN

/** Mission Control votes on Eyeke. */
export const VOTING_PLANET = 'eyeke'

export interface Candidate {
  wallet: string
  name: string
  description: string
  image: string
  votes: number
}

/** Candidate names, descriptions and avatars come from the Alien Worlds DAO API. */
async function fetchProfiles(planet: string): Promise<CandidateProfile[]> {
  const res = await fetch(`https://api.alienworlds.io/v2/dao/${planet}/candidates?walletId=aa`, {
    signal: AbortSignal.timeout(10_000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Active candidates of the planet with the votes Mission Control cast for them, most votes first. */
export function useCandidates(planet: string = VOTING_PLANET) {
  const dao = useQuery({ queryKey: ['voting', 'dao', planet], queryFn: () => readDaoCandidates(planet), staleTime: 10 * MIN })
  const votes = useQuery({ queryKey: ['voting', 'votes', planet], queryFn: () => readPlanetCandidates(planet), staleTime: MIN })
  const blocked = useQuery({ queryKey: ['voting', 'blocklist'], queryFn: readVoteBlocklist, staleTime: HOUR })
  const profiles = useQuery({ queryKey: ['voting', 'profiles', planet], queryFn: () => fetchProfiles(planet), staleTime: 30 * MIN, retry: 1 })

  const candidates = useMemo<Candidate[]>(() => {
    const blockedWallets = new Set((blocked.data ?? []).map((row) => row.wallet))
    const voteCount = new Map((votes.data ?? []).map((row) => [row.wallet, row.votes]))
    const profile = new Map((profiles.data ?? []).map((row) => [row.account, row]))

    return (dao.data ?? [])
      .filter((row) => row.is_active === 1 && !blockedWallets.has(row.candidate_name))
      .map((row) => {
        const info = profile.get(row.candidate_name)
        return {
          wallet: row.candidate_name,
          name: info?.givenName?.trim() || row.candidate_name,
          description: info?.description?.trim() ?? '',
          image: info?.image ?? '',
          votes: voteCount.get(row.candidate_name) ?? 0
        }
      })
      .sort((a, b) => b.votes - a.votes)
  }, [dao.data, votes.data, blocked.data, profiles.data])

  return {
    candidates,
    isLoading: dao.isLoading || votes.isLoading,
    isFetching: dao.isFetching || votes.isFetching || profiles.isFetching
  }
}

/**
 * The candidates in the player's most recent vote on the planet, in the order they were cast.
 * History only reaches back about a month; an older vote yields an empty list.
 */
export function useLastVote(account: string | null, planet: string = VOTING_PLANET) {
  const history = useQuery({ queryKey: ['voting', 'history'], queryFn: readVoteHistory, enabled: !!account, staleTime: MIN })

  const wallets = useMemo(() => {
    const mine = (history.data ?? []).filter((row) => row.voter === account && row.planet === planet)
    if (mine.length === 0) return []
    // One vote writes a row per candidate, all with the same timestamp.
    const latest = mine.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)).timestamp
    return mine
      .filter((row) => row.timestamp === latest)
      .sort((a, b) => a.index - b.index)
      .map((row) => row.candidate)
  }, [history.data, account, planet])

  return { wallets, isFetched: history.isFetched }
}

/** Vote power: what was claimed plus the shards earned since, capped by the contract maximum. */
export function useVotePower(account: string | null) {
  const config = useQuery({ queryKey: ['voting', 'config'], queryFn: readVotingConfig, staleTime: HOUR })
  const member = useMember(account)
  const points = useUserPoints(account)

  const max = config.data?.max_votes ?? 0
  const earned = (points.data?.total_points ?? 0) - (member.data?.last_voteclaim_shards ?? 0)
  const current = Math.max(0, Math.min(max, (member.data?.vote_power ?? 0) + earned))

  return { current, max, isLoading: config.isLoading || member.isLoading || points.isLoading }
}

export function refreshVoting(account: string | null) {
  return Promise.all([queryClient.invalidateQueries({ queryKey: ['voting'] }), refreshPlayer(account)])
}
