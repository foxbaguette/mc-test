import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { atomic } from '@/chain/atomic'
import { PLANETS, type Planet } from '@/chain/config'
import { tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'
import { useAccount } from '@/state/session'

import { queryClient } from './queryClient'
import * as t from './tables'
import type { CurrentLand, EquippedTool, LandData, ToolData, Treasure, UserWeekly, Week } from './types'

const MIN = 60_000
const HOUR = 60 * MIN

// ---------------------------------------------------------------------------
// Global game data
// ---------------------------------------------------------------------------

export function useWeeks() {
  const query = useQuery({ queryKey: ['weeks'], queryFn: t.readWeeks, staleTime: 10 * MIN })
  return useMemo(() => {
    const weeks = query.data ?? []
    const now = Date.now()
    const currentWeek = weeks.find((w) => +chainDate(w.start_date) <= now && now < +chainDate(w.end_date))
    return { ...query, weeks, currentWeek, prizePool: tlmToNumber(currentWeek?.initial_prize_pool) }
  }, [query])
}

export const useMissionSettings = () =>
  useQuery({ queryKey: ['missionSettings'], queryFn: t.readMissionSettings, staleTime: HOUR })

export const useQuests = () => useQuery({ queryKey: ['quests'], queryFn: t.readQuests, staleTime: 10 * MIN })

export const useCollectInfo = () => useQuery({ queryKey: ['collectInfo'], queryFn: t.readCollectInfo, staleTime: 20 * MIN })

export const useLevels = () => useQuery({ queryKey: ['levels'], queryFn: t.readLevels, staleTime: 24 * HOUR })

export const useMcSettings = () => useQuery({ queryKey: ['mcSettings'], queryFn: t.readMcSettings, staleTime: HOUR })

export const useActivity = () =>
  useQuery({ queryKey: ['activity'], queryFn: t.readActivity, staleTime: MIN, refetchInterval: MIN })

export const useSponsors = () =>
  useQuery({ queryKey: ['sponsors'], queryFn: t.readSponsors, staleTime: MIN, refetchInterval: MIN })

export const useTips = () => useQuery({ queryKey: ['tips'], queryFn: t.readTips, staleTime: HOUR })

export function useClaimChances() {
  return useQuery({
    queryKey: ['claimChances'],
    queryFn: t.readClaimChances,
    staleTime: HOUR,
    select: (rows) => [...rows].sort((a, b) => a.order - b.order)
  })
}

export const useLandTypes = () => useQuery({ queryKey: ['landTypes'], queryFn: t.readLandTypes, staleTime: HOUR })

export const useAwTools = () => useQuery({ queryKey: ['awTools'], queryFn: t.readAwTools, staleTime: HOUR })

export const useMineTrack = () => useQuery({ queryKey: ['mineTrack'], queryFn: t.readMineTrack, staleTime: 20 * MIN })

/** min_commission per planet, as a fraction (500 -> 0.05). */
export function usePlanetMinCommission() {
  return useQuery({
    queryKey: ['planetMinCommission'],
    staleTime: HOUR,
    queryFn: async () => {
      const entries = await Promise.all(
        PLANETS.map(async (planet) => {
          const config = await t.readPlanetConfig(planet)
          const min = config.find((c) => c.key === 'min_commission')?.value?.[1] ?? 0
          return [planet, min / 10000] as const
        })
      )
      return Object.fromEntries(entries) as Record<Planet, number>
    }
  })
}

export function usePlanetPools() {
  return useQuery({
    queryKey: ['planetPools'],
    staleTime: 5 * MIN,
    queryFn: async () => {
      const entries = await Promise.all(
        PLANETS.map(async (planet) => {
          const pools = await t.readPlanetPools(planet)
          return [planet, Object.fromEntries((pools?.pool_buckets ?? []).map((b) => [b.key, tlmToNumber(b.value)]))] as const
        })
      )
      return Object.fromEntries(entries) as Record<Planet, Record<string, number>>
    }
  })
}

export interface TreasureHunt extends Treasure {
  planetName: string
  landName: string
  land: LandData
}

/**
 * Every hunt that is worth showing: still undistributed, started within the last
 * ten hours or starting within the week. Several can run at once.
 */
export function useTreasureHunts() {
  return useQuery({
    queryKey: ['treasureHunts'],
    staleTime: 10 * MIN,
    queryFn: async (): Promise<TreasureHunt[]> => {
      const rows = await t.readTreasures()
      const now = Date.now()
      const open = rows
        .filter((row) => {
          const start = +chainDate(row.start_date)
          return !row.is_distributed && start > now - 10 * HOUR && start < now + 7 * 24 * HOUR
        })
        .sort((a, b) => +chainDate(a.start_date) - +chainDate(b.start_date))
      if (open.length === 0) return []

      // One lookup for every hunt's land, rather than one request each.
      const assets = await atomic.getAssetsByIds<LandData>(open.map((row) => row.land_id))
      const byId = new Map(assets.map((asset) => [asset.asset_id, asset]))
      return open.flatMap((row) => {
        const asset = byId.get(row.land_id)
        if (!asset) return []
        const [landName, planetName] = asset.data.name.split(' on ')
        return [{ ...row, land: asset.data, landName, planetName }]
      })
    }
  })
}

export interface FinishedHunt extends TreasureHunt {
  winners: string[]
}

/** The hunts that have already paid out, newest first, with the wallets that shared them. */
export function useFinishedHunts(limit = 8) {
  return useQuery({
    queryKey: ['treasureHunts', 'finished', limit],
    staleTime: 30 * MIN,
    queryFn: async (): Promise<FinishedHunt[]> => {
      const rows = await t.readTreasures()
      const done = rows
        .filter((row) => row.is_distributed)
        .sort((a, b) => +chainDate(b.start_date) - +chainDate(a.start_date))
        .slice(0, limit)
      if (done.length === 0) return []

      const [assets, winners] = await Promise.all([
        atomic.getAssetsByIds<LandData>(done.map((row) => row.land_id)),
        Promise.all(done.map((row) => t.readTreasureWinners(row.treasure_name).catch(() => null)))
      ])
      const byId = new Map(assets.map((asset) => [asset.asset_id, asset]))

      return done.map((row, i) => {
        const asset = byId.get(row.land_id)
        const [landName = '', planetName = ''] = asset?.data.name.split(' on ') ?? []
        return {
          ...row,
          land: asset?.data ?? ({} as LandData),
          landName,
          planetName,
          winners: winners[i]?.winners ?? []
        }
      })
    }
  })
}

// ---------------------------------------------------------------------------
// Player data
// ---------------------------------------------------------------------------

export const useMember = (account: string | null) =>
  useQuery({ queryKey: ['member', account], queryFn: () => t.readMember(account!), enabled: !!account, staleTime: MIN })

export const useUserPoints = (account: string | null) =>
  useQuery({ queryKey: ['userPoints', account], queryFn: () => t.readUserPoints(account!), enabled: !!account, staleTime: MIN })

export const useTlmBalance = (account: string | null) =>
  useQuery({ queryKey: ['tlm', account], queryFn: () => t.readTlmBalance(account!), enabled: !!account, staleTime: MIN })

/** A player who has never signed up in Alien Legends has no row at all. */
export const useAlePlayer = (account: string | null) =>
  useQuery({ queryKey: ['alePlayer', account], queryFn: () => t.readAlePlayer(account!), enabled: !!account, staleTime: HOUR })

export const usePlayerSupport = (account: string | null) =>
  useQuery({ queryKey: ['support', account], queryFn: () => t.readPlayerSupport(account!), enabled: !!account, staleTime: HOUR })

export interface WeeklyWithWeek extends UserWeekly {
  week?: Week
  expiresAt: number
}

export function useUserWeeklies(account: string | null) {
  const weeks = useWeeks()
  const query = useQuery({
    queryKey: ['userWeeklies', account],
    queryFn: () => t.readUserWeeklies(account!),
    enabled: !!account,
    staleTime: 5 * MIN
  })

  return useMemo(() => {
    const now = Date.now()
    const weeklies: WeeklyWithWeek[] = (query.data ?? []).map((row) => ({
      ...row,
      week: weeks.weeks.find((w) => w.start_date === row.week_start),
      expiresAt: +chainDate(row.week_start) + 5 * 7 * 24 * HOUR
    }))
    const current = weeklies.find((w) => {
      const start = +chainDate(w.week_start)
      return start <= now && now < start + 7 * 24 * HOUR
    })
    return { ...query, weeklies, current }
  }, [query, weeks.weeks])
}

/** Everything the header and profile show about the logged-in player. */
export function usePlayer() {
  const account = useAccount()
  const member = useMember(account)
  const points = useUserPoints(account)
  const tlm = useTlmBalance(account)
  const weeklies = useUserWeeklies(account)
  const support = usePlayerSupport(account)

  const m = member.data
  const p = points.data
  const mcPoints = (p?.total_points ?? 0) - ((m?.mcp_start ?? 0) + (m?.mcp_used ?? 0)) + (m?.mcp_gained ?? 0)

  return {
    account,
    member: m ?? null,
    isMember: !!m,
    isFullMember: !!m?.member,
    isTrial: !!m?.trial,
    flagged: !!m?.flagged,
    mcPoints,
    redeemablePoints: (p?.redeemable_points ?? 0) / 10,
    rewardPoints: weeklies.current?.total_quest_points ?? 0,
    tlm: tlm.data ?? 0,
    currentWeekly: weeklies.current,
    weeklies: weeklies.weeklies,
    isSupport: !!support.data?.wallet,
    isLoading: member.isLoading || points.isLoading
  }
}

export function refreshPlayer(account: string | null) {
  if (!account) return Promise.resolve()
  return Promise.all(
    ['member', 'userPoints', 'tlm', 'userWeeklies'].map((key) => queryClient.invalidateQueries({ queryKey: [key, account] }))
  )
}

// ---------------------------------------------------------------------------
// Mining
// ---------------------------------------------------------------------------

export function useMiner(account: string | null) {
  return useQuery({
    queryKey: ['miner', account],
    enabled: !!account,
    staleTime: 20 * MIN,
    queryFn: async () => {
      const miner = await t.readMiner(account!)
      if (!miner) return null
      const asset = await atomic.getAsset<LandData>(miner.current_land)
      const [landName, planetName] = asset.data.name.split(' on ')
      const land: CurrentLand = { ...asset.data, asset_id: asset.asset_id, owner: asset.owner, landName, planetName }
      return { ...miner, land }
    }
  })
}

export function useEquippedTools(account: string | null) {
  const awTools = useAwTools()
  return useQuery({
    queryKey: ['equippedTools', account],
    enabled: !!account && !!awTools.data,
    staleTime: 20 * MIN,
    queryFn: async (): Promise<EquippedTool[]> => {
      const bag = await t.readBag(account!)
      if (!bag?.items.length) return []
      const [assets, uses] = await Promise.all([
        atomic.getAssetsByIds<ToolData>(bag.items),
        Promise.all(bag.items.map((id) => t.readToolUse(id)))
      ])
      return bag.items.flatMap((id, i) => {
        const asset = assets.find((a) => a.asset_id === id)
        if (!asset) return []
        const templateId = asset.template?.template_id ?? ''
        const stats = awTools.data!.find((tool) => String(tool.template_id) === templateId && tool.shine === asset.data.shine)
        return [
          {
            ...asset.data,
            asset_id: id,
            template_id: templateId,
            last_use: Number(uses[i]?.last_use ?? 0),
            cooldown_seconds: stats?.cooldown_seconds ?? 0,
            mining_power: stats?.mining_power ?? 0,
            nft_power: stats?.nft_power ?? 0,
            pow: stats?.pow ?? 0,
            toolname: stats?.toolname ?? asset.data.name
          }
        ]
      })
    }
  })
}

export function useToolInventory(account: string | null) {
  return useQuery({
    queryKey: ['toolInventory', account],
    enabled: !!account,
    staleTime: HOUR,
    queryFn: () => atomic.getOwnedAssets<ToolData>({ owner: account!, collection_name: 'alien.worlds', schema_name: 'tool.worlds' })
  })
}

export function refreshMining(account: string | null) {
  return Promise.all(
    ['miner', 'equippedTools', 'favorites'].map((key) => queryClient.invalidateQueries({ queryKey: [key, account] }))
  )
}
