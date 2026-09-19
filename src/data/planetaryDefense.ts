import { useQuery } from '@tanstack/react-query'

import { chainDate } from '@/lib/time'

import { pdKeys } from './keys'
import { queryClient, refetchOnReturn } from './queryClient'
import {
  readPdChest,
  readPdDefenseMissions,
  readPdDefenseWins,
  readPdInForge,
  readPdMember,
  readPdMissions,
  readPdOwner,
  readPdOwners,
  readPdPlayer,
  readPdPlayerMissions,
  readPdPvpRounds,
  readPdRequests,
  readPdSupports
} from './tables'
import type { PdMission, PdOwner, PdPlayer, PdPvp, PdRequest, PdSupport } from './types/planetaryDefense'

const MIN = 60_000
const HOUR = 60 * MIN

/**
 * Whether the player has a Planetary Defense account, which decides whether its menu item and page
 * show: players are in the members table, warlords (land owners) only in owners.
 */
export const usePdMember = (account: string | null) =>
  useQuery({
    queryKey: pdKeys.member(account),
    queryFn: async () => {
      const [member, owner] = await Promise.all([readPdMember(account!), readPdOwner(account!)])
      return !!member || !!owner
    },
    enabled: !!account,
    staleTime: HOUR,
    // Only decides whether the menu item shows.
    meta: { silentError: true }
  })

export const usePdMissions = () =>
  useQuery({ queryKey: pdKeys.missions, queryFn: readPdMissions, staleTime: MIN, refetchOnWindowFocus: refetchOnReturn })

export const usePdPlayerMissions = (account: string | null) =>
  useQuery({
    queryKey: pdKeys.playerMissions(account),
    queryFn: () => readPdPlayerMissions(account!),
    enabled: !!account,
    staleTime: MIN
  })

/** The player's power: a warlord's comes from the owners table, everyone else's from players. */
export const usePdPower = (account: string | null) =>
  useQuery({
    queryKey: pdKeys.power(account),
    queryFn: async () => {
      const [owner, player, forge] = await Promise.all([readPdOwner(account!), readPdPlayer(account!), readPdInForge(account!)])
      return { owner, player, inForge: !!forge }
    },
    enabled: !!account,
    staleTime: 5 * MIN
  })

export const usePdOwners = () => useQuery({ queryKey: pdKeys.owners, queryFn: readPdOwners, staleTime: 5 * MIN })

export const usePdSupports = () =>
  useQuery({ queryKey: pdKeys.supports, queryFn: readPdSupports, staleTime: MIN, refetchOnWindowFocus: refetchOnReturn })

export const usePdRequests = (account: string | null, as: 'player' | 'warlord') =>
  useQuery({
    queryKey: pdKeys.requests(account, as),
    queryFn: () => readPdRequests(account!, as),
    enabled: !!account,
    staleTime: MIN,
    refetchOnWindowFocus: refetchOnReturn
  })

export const usePdDefenseMissions = () =>
  useQuery({ queryKey: pdKeys.defense, queryFn: readPdDefenseMissions, staleTime: 5 * MIN })

export const usePdDefenseWins = () => useQuery({ queryKey: pdKeys.defenseWins, queryFn: readPdDefenseWins, staleTime: 30 * MIN })

/** The latest PvP rounds, newest first. */
export const usePdPvp = () =>
  useQuery({
    queryKey: pdKeys.pvp,
    queryFn: () => readPdPvpRounds(6),
    staleTime: MIN,
    refetchInterval: 2 * MIN,
    refetchOnWindowFocus: refetchOnReturn
  })

export const usePdChest = (landId: string | undefined) =>
  useQuery({
    queryKey: pdKeys.chest(landId),
    queryFn: () => readPdChest(landId!),
    enabled: !!landId,
    staleTime: 5 * MIN,
    meta: { silentError: true }
  })

/** Everything on the page, after the player signed something. */
export const refreshPlanetaryDefense = () => queryClient.invalidateQueries({ queryKey: pdKeys.all })

// Game rules, kept pure so they can be tested.

export type MissionState = 'live' | 'completed' | 'ended'

export function missionState(mission: PdMission, now: number): MissionState {
  if (mission.is_completed) return 'completed'
  return +chainDate(mission.deadline) > now ? 'live' : 'ended'
}

/** The mission to show: the live one ending soonest, else the one that ended last. */
export function currentMission(missions: PdMission[], now: number): PdMission | null {
  const byDeadline = [...missions].sort((a, b) => +chainDate(a.deadline) - +chainDate(b.deadline))
  return byDeadline.find((m) => missionState(m, now) === 'live') ?? byDeadline[byDeadline.length - 1] ?? null
}

export interface Power {
  attack: number
  defense: number
  moveCost: number
  /** Only warlords own lands. */
  lands: number
}

/** The power that counts: with the Forge bonus while the player is in the forge. */
export function effectivePower(row: PdPlayer | PdOwner | null | undefined, inForge: boolean): Power {
  if (!row) return { attack: 0, defense: 0, moveCost: 0, lands: 0 }
  return {
    attack: inForge ? row.totalAttackArm : row.totalAttack,
    defense: inForge ? row.totalDefenseArm : row.totalDefense,
    moveCost: row.totalMoveCost,
    lands: 'numberofland' in row ? row.numberofland : 0
  }
}

/** The team the player supports, if any. */
export const teamOf = (supports: PdSupport[], account: string) => supports.find((row) => row.supporters.includes(account)) ?? null

/** A request still waiting for an answer. */
export const isOpenRequest = (request: PdRequest, now: number) =>
  request.status === 'pending' && +chainDate(request.expiration_time) > now

/** The accepted request that made `player` a supporter of `warlord`: leaving or removing needs its id. */
export const acceptedRequest = (requests: PdRequest[], player: string, warlord: string) =>
  requests
    .filter((r) => r.status === 'accepted' && r.player === player && r.warlord === warlord)
    .sort((a, b) => b.request_id - a.request_id)[0] ?? null

/** When the current PvP phase closes. */
export function pvpPhaseEnd(pvp: PdPvp): number {
  if (pvp.phase === 'defense') return pvp.defense_end_time * 1000
  if (pvp.phase === 'attack') return pvp.attack_end_time * 1000
  return 0
}

/** Which side the player is on, if any. */
export function pvpSide(pvp: PdPvp, account: string): 'defense' | 'attack' | null {
  if (pvp.defense_list.includes(account)) return 'defense'
  if (pvp.attack_list.includes(account)) return 'attack'
  return null
}

/** Whether the player can still join this round, and on which side. */
export function pvpJoinable(pvp: PdPvp, account: string, now: number): 'defense' | 'attack' | null {
  if (pvpSide(pvp, account)) return null
  if (pvp.phase === 'defense' && pvp.defense_end_time * 1000 > now) return 'defense'
  if (pvp.phase === 'attack' && pvp.attack_end_time * 1000 > now) return 'attack'
  return null
}
