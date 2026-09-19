import { useQuery } from '@tanstack/react-query'

import { atomic } from '@/chain/atomic'
import { CONTRACTS } from '@/chain/config'
import { getRowHistory, getTableHistory, type TableDelta } from '@/chain/history'

import { chainDate } from '@/lib/time'

import { pdKeys } from './keys'
import { queryClient, refetchOnReturn } from './queryClient'
import {
  readPdChests,
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
  readPdSupports,
  readDaoVote,
  readVoteWeight
} from './tables'
import type { LandData } from './types/mining'
import type { PdChest, PdMission, PdOwner, PdPlayer, PdPvp, PdRequest, PdSupport } from './types/planetaryDefense'

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

/** The latest PvP round (as a one-row list). */
export const usePdPvp = () =>
  useQuery({
    queryKey: pdKeys.pvp,
    queryFn: () => readPdPvpRounds(1),
    staleTime: MIN,
    refetchInterval: 2 * MIN,
    refetchOnWindowFocus: refetchOnReturn
  })

/**
 * Who joined a PvP round and what each brought. The contract only keeps each side's total, so the
 * row's history is read: every join adds one name and raises that side's score by exactly their share.
 */
export const usePdPvpRoster = (id: number | undefined) =>
  useQuery({
    queryKey: pdKeys.pvpRoster(id),
    queryFn: async ({ signal }) =>
      pvpContributions(await getRowHistory<PvpDeltaRow>(CONTRACTS.PLANETARY_DEFENSE, 'pvp3', id!, signal)),
    enabled: id !== undefined,
    staleTime: 2 * MIN,
    refetchInterval: 5 * MIN,
    refetchOnWindowFocus: refetchOnReturn
  })

export interface PdLand {
  assetId: string
  landName: string
  planetName: string
  x: number
  y: number
  rarity: string
  chest: PdChest | null
}

/** A warlord's lands in Planetary Defense: each land's details and its chest. */
export const usePdLands = (account: string | null, landIds: string[] | undefined) =>
  useQuery({
    queryKey: pdKeys.lands(account),
    queryFn: async (): Promise<PdLand[]> => {
      const [assets, chests] = await Promise.all([atomic.getAssetsByIds<LandData>(landIds!), readPdChests()])
      const chestOf = new Map(chests.map((c) => [String(c.land_id), c]))
      return assets
        .map((asset) => {
          const [landName, planetName] = asset.data.name.split(' on ')
          return {
            assetId: asset.asset_id,
            landName,
            planetName: planetName ?? asset.data.planet,
            x: asset.data.x,
            y: asset.data.y,
            rarity: asset.data.rarity,
            chest: chestOf.get(asset.asset_id) ?? null
          }
        })
        .sort((a, b) => (b.chest?.TLM ?? 0) - (a.chest?.TLM ?? 0))
    },
    enabled: !!account && !!landIds?.length,
    staleTime: 5 * MIN
  })

/** The player's Magor vote power before decay, and when they last voted, for the payout bonus. */
export const usePdVotePower = (account: string | null) =>
  useQuery({
    queryKey: pdKeys.votePower(account),
    queryFn: async () => {
      const [weight, vote] = await Promise.all([readVoteWeight('magor', account!), readDaoVote('magor', account!)])
      return { weight: (weight?.weight ?? 0) / 10000, votedAt: vote ? +chainDate(vote.vote_time_stamp) : 0 }
    },
    enabled: !!account,
    staleTime: 30 * MIN,
    // Without it the estimate simply leaves out the vote power bonus.
    meta: { silentError: true }
  })

/**
 * When each defense win was recorded, by row id: the chain keeps no date on the rows, so it comes
 * from the table's history. A row missing from a node's index simply has no date.
 */
export const usePdDefenseWinTimes = () =>
  useQuery({
    queryKey: pdKeys.defenseWinTimes,
    queryFn: async ({ signal }) => {
      const history = await getTableHistory<unknown>(CONTRACTS.PLANETARY_DEFENSE, 'defwin2', signal)
      const times = new Map<string, number>()
      for (const delta of history)
        if (!times.has(delta.primary_key)) times.set(delta.primary_key, +new Date(`${delta.timestamp}Z`))
      return times
    },
    staleTime: 30 * 60_000,
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

/** Cooldown after an attack: 3 hours plus 10 seconds per point of move cost (the heavier the army, the slower). */
export const attackCooldownMs = (moveCost: number) => (3 * 3600 + 10 * moveCost) * 1000

/** When the player can attack a mission again: the cooldown counted from their last attack on it. */
export const attackReadyAt = (lastAttackSeconds: number | undefined, moveCost: number) =>
  lastAttackSeconds ? lastAttackSeconds * 1000 + attackCooldownMs(moveCost) : 0

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

/** A pvp3 row as the history nodes store it: numbers arrive as strings. */
export interface PvpDeltaRow {
  defense_list: string[]
  attack_list: string[]
  defense_score: string | number
  attack_score: string | number
}

export interface PvpContribution {
  player: string
  score: number
}

/**
 * Each player's share of a PvP round, largest first: the score each join added to its side.
 * Versions that change nothing (the contract rewrites the row often) are skipped.
 */
export function pvpContributions(history: TableDelta<PvpDeltaRow>[]): {
  defense: PvpContribution[]
  attack: PvpContribution[]
} {
  const defense = new Map<string, number>()
  const attack = new Map<string, number>()
  let prev: PvpDeltaRow | null = null
  for (const { data } of history) {
    if (prev) {
      for (const [list, scoreKey, into] of [
        ['defense_list', 'defense_score', defense],
        ['attack_list', 'attack_score', attack]
      ] as const) {
        const joined = data[list].filter((p) => !prev![list].includes(p))
        const added = Number(data[scoreKey]) - Number(prev[scoreKey])
        // One join per version in practice; if several share one, split what they added.
        for (const player of joined) into.set(player, (into.get(player) ?? 0) + added / joined.length)
      }
    } else {
      // The first stored version may already list players: nothing to measure their share against.
      for (const player of data.defense_list) defense.set(player, 0)
      for (const player of data.attack_list) attack.set(player, 0)
    }
    prev = data
  }
  const sorted = (map: Map<string, number>) =>
    [...map].map(([player, score]) => ({ player, score: Math.round(score) })).sort((a, b) => b.score - a.score)
  return { defense: sorted(defense), attack: sorted(attack) }
}

/** The chest names and levels from the Planetary Defense guide; level 16 is the Ultimate Chest. */
const CHEST_NAMES = [
  'Basic',
  'Enhanced',
  'Reinforced',
  'Fortified',
  'Armored',
  'Epic',
  'Legend',
  'Mythical',
  'Titan',
  'Divine',
  'Celestial',
  'Eternal',
  'Supra',
  'Cosmic',
  'Astral',
  'Ultimate'
]

/**
 * A chest's name and its PvP protection (also its extra payout): 2.5% per level, 40% at the top.
 * Every land has one; level 0 is the base chest, never upgraded and unprotected.
 */
export function chestInfo(level: number): { name: string; protection: number } {
  if (level < 1) return { name: 'Base Chest', protection: 0 }
  const clamped = Math.min(level, CHEST_NAMES.length)
  return { name: `${CHEST_NAMES[clamped - 1]} Chest`, protection: clamped * 2.5 }
}

/**
 * The next chest payout: 00:01 UTC on the 1st or the 16th of the month, whichever comes first.
 */
export function nextPayoutAt(now: number): number {
  const d = new Date(now)
  const at = (month: number, day: number) => Date.UTC(d.getUTCFullYear(), month, day, 0, 1)
  const candidates = [at(d.getUTCMonth(), 1), at(d.getUTCMonth(), 16), at(d.getUTCMonth() + 1, 1)]
  return candidates.find((t) => t > now)!
}

const MONTH_S = 2_629_800

/** Vote power after decay: it halves for every month since the player last voted. */
export const decayedVotePower = (weight: number, votedAt: number, at: number) =>
  weight > 0 && votedAt > 0 ? weight / Math.pow(2, (at - votedAt) / 1000 / MONTH_S) : 0

/** The guide's vote power tiers: 0.5% more payout per tier reached, 20% from 15,000,000. */
const VP_TIERS = [
  1, 1_000, 3_000, 5_000, 10_000, 15_000, 20_000, 25_000, 50_000, 75_000, 100_000, 125_000, 150_000, 200_000, 250_000, 300_000,
  350_000, 400_000, 450_000, 500_000, 600_000, 700_000, 800_000, 900_000, 1_000_000, 1_250_000, 1_500_000, 2_000_000, 2_500_000,
  3_000_000, 3_500_000, 4_000_000, 4_500_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000, 15_000_000
]

export const votePowerBonus = (votePower: number) => VP_TIERS.filter((tier) => votePower >= tier).length * 0.5

/** One payout from a chest: 1% base, plus the chest level's share, plus the vote power bonus (all in %). */
export const chestPayout = (pdt: number, chestLevel: number, voteBonus: number) =>
  (pdt * (1 + chestInfo(chestLevel).protection + voteBonus)) / 100

/** What the player's attack points are worth if the mission succeeds: rewards split by share of points. */
export function missionShare(myPoints: number, totalPoints: number, rewardTlm: number, rewardShards: number) {
  const share = totalPoints > 0 ? myPoints / totalPoints : 0
  return { share, tlm: rewardTlm * share, shards: rewardShards * share }
}

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
