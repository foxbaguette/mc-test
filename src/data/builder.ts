import { useQuery } from '@tanstack/react-query'

import { atomic } from '@/chain/atomic'
import { chainDate } from '@/lib/time'
import { publicUrl } from '@/lib/publicUrl'

import { queryClient } from './queryClient'
import * as t from './tables'
import type { BuilderPlayer, BuilderSettings, BuilderSwapPool, PlayerBuilding } from './types/builder'
import { builderKeys } from './keys'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY_MS = 86_400_000

export const BUILDER_INFO_URL = 'https://medium.com/mining-matters/outpost-building-game-99ce21da1744'

const PRODUCTION_ORDER = ['prodone', 'prodtwo', 'prodthree', 'prodfour', 'prodfive', 'prodsix']

export const buildingImage = (id: string) => publicUrl(`/assets/mcp/${id}.png`)

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const useBuilderSeason = () =>
  useQuery({ queryKey: builderKeys.season, queryFn: t.readBuilderSeason, staleTime: 10 * MIN })

export const useBuilderSettings = () =>
  useQuery({ queryKey: builderKeys.settings, queryFn: t.readBuilderSettings, staleTime: 10 * MIN })

export const useSwapPool = () => useQuery({ queryKey: builderKeys.swappool, queryFn: t.readSwapPool, staleTime: 30_000 })

export const useBuildingDefs = () => useQuery({ queryKey: builderKeys.buildings, queryFn: t.readBuildingDefs, staleTime: HOUR })

export const useBuilderBonuses = () => useQuery({ queryKey: builderKeys.bonuses, queryFn: t.readBuilderBonuses, staleTime: HOUR })

export const useBuilderPlayer = (account: string | null) =>
  useQuery({
    queryKey: builderKeys.player(account),
    queryFn: () => t.readBuilderPlayer(account!),
    enabled: !!account,
    staleTime: MIN
  })

export type LeaderboardSort = 'score' | 'rate' | 'mcp'

const LEADERBOARD_INDEX: Record<LeaderboardSort, number> = { mcp: 2, score: 3, rate: 4 }

export const useBuilderLeaderboard = (sort: LeaderboardSort) =>
  useQuery({
    queryKey: builderKeys.leaderboard(sort),
    queryFn: () => t.readBuilderLeaderboard(LEADERBOARD_INDEX[sort]),
    staleTime: MIN
  })

export const useBuilderRanking = () =>
  useQuery({ queryKey: builderKeys.ranking, queryFn: t.readBuilderRanking, staleTime: 10 * MIN })

export interface InventoryGroup {
  template_id: string
  name: string
  rarity: string
  shine: string
  assetIds: string[]
}

/** The player's NFTs of one schema, one entry per template. */
export function useSchemaInventory(account: string | null, schema: string | undefined) {
  return useQuery({
    queryKey: builderKeys.inventory(account, schema),
    enabled: !!account && !!schema,
    staleTime: 5 * MIN,
    queryFn: async () => {
      const assets = await atomic.getOwnedAssets<{ name?: string; rarity?: string; shine?: string }>({
        owner: account!,
        collection_name: 'alien.worlds',
        schema_name: schema!
      })
      const groups = new Map<string, InventoryGroup>()
      for (const asset of assets) {
        const id = asset.template?.template_id
        if (!id) continue
        const group = groups.get(id)
        if (group) group.assetIds.push(asset.asset_id)
        else
          groups.set(id, {
            template_id: id,
            name: asset.data.name ?? id,
            rarity: asset.data.rarity ?? '',
            shine: asset.data.shine || 'Stone',
            assetIds: [asset.asset_id]
          })
      }
      return [...groups.values()]
    }
  })
}

export function refreshBuilder() {
  return Promise.all(
    [builderKeys.playerAll, builderKeys.settings, builderKeys.swappool, builderKeys.season, builderKeys.inventoryAll].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey })
    )
  )
}

// ---------------------------------------------------------------------------
// Game math (mirrors game.mc)
// ---------------------------------------------------------------------------

/** "8,352 k": the number style players know from the original Builder. */
export function formatR(value: number, decimals = 3): string {
  const suffixes = ['', '', 'k', 'M', 'B', 'T']
  let magnitude = 0
  let scaled = value
  while (scaled >= 1000 && magnitude < suffixes.length - 1) {
    scaled /= 1000
    magnitude++
  }
  const fixed = value > 999 ? scaled.toFixed(decimals).replace('.', ',') : Math.floor(value)
  return `${fixed} ${suffixes[magnitude]}`.trim()
}

export function splitBuildings(buildings: PlayerBuilding[]) {
  const production = buildings
    .filter((b) => b.building_type === 'production')
    .sort((a, b) => PRODUCTION_ORDER.indexOf(a.buildingid) - PRODUCTION_ORDER.indexOf(b.buildingid))
  const special = buildings.filter((b) => b.building_type !== 'production')
  return { production, special }
}

/** Resources right now: stored amount plus production since the last claim, capped by storage. */
export function currentResources(player: BuilderPlayer, now: number) {
  const seconds = Math.max(0, (now - +chainDate(player.last_claim)) / 1000)
  return Math.min(player.max_gamecurrency, player.gamecurrency + (seconds * player.gamecurrency_per_minute) / 60)
}

export function msUntilFull(player: BuilderPlayer, now: number) {
  const missing = player.max_gamecurrency - currentResources(player, now)
  return player.gamecurrency_per_minute > 0 ? (missing / player.gamecurrency_per_minute) * MIN : 0
}

export const cooldownEnd = (lastInteraction: string, seconds = 0) => +chainDate(lastInteraction) + seconds * 1000

/** Exploder uses today (UTC day, as the contract counts them). */
export function exploderUses(building: PlayerBuilding, now: number) {
  return Math.floor(+chainDate(building.last_interaction) / DAY_MS) === Math.floor(now / DAY_MS)
    ? building.todays_interactions
    : 0
}

/** What the Exploder grants now; the first use of the day pays five times. */
export function exploderGrant(building: PlayerBuilding, player: BuilderPlayer, now: number) {
  const base = player.gamecurrency_per_minute * building.building_level * (exploderUses(building, now) === 0 ? 5 : 1)
  return Math.max(100, Math.floor(base * (1 + building.nft_bonuspercent / 100)))
}

function pool(swap: BuilderSwapPool) {
  const mcp = Number(swap.mcp)
  const gc = Number(swap.gamecurrency)
  return { mcp, gc, product: mcp * gc }
}

/** MCP for delivering `amount` Я at the Spaceport, including its level and NFT bonus. */
export function estimateMcpForDelivery(swap: BuilderSwapPool | null | undefined, amount: number, market: PlayerBuilding) {
  if (!swap || amount <= 0) return 0
  const { mcp, gc, product } = pool(swap)
  const entered = amount * (1 + (market.building_level + market.nft_bonuspercent) / 100)
  return Math.max(0, Math.floor(mcp - product / (gc + entered)))
}

/** Я received for spending `qp` quest points, capped by storage. */
export function estimateResourcesForQp(
  swap: BuilderSwapPool | null | undefined,
  settings: BuilderSettings | null | undefined,
  qp: number,
  max: number
) {
  if (!swap || !settings || qp <= 0) return 0
  const { mcp, gc, product } = pool(swap)
  return Math.min(max, Math.max(0, gc - product / (mcp + qp * settings.mcpperqp)))
}

/** Quest points needed to fill the storage completely. */
export function qpToFillStorage(
  swap: BuilderSwapPool | null | undefined,
  settings: BuilderSettings | null | undefined,
  current: number,
  max: number
) {
  if (!swap || !settings) return 0
  const { mcp, gc, product } = pool(swap)
  const remaining = gc - (max - current)
  if (remaining <= 0) return 0
  return Math.max(1, Math.round((product / remaining - mcp) / settings.mcpperqp))
}

/** Shard colour for a leaderboard position (0-based), as on the original leaderboard. */
export function shardColor(index: number) {
  if (index < 3) return '#e80066'
  if (index < 10) return '#e69839'
  if (index < 25) return '#9716ec'
  if (index < 50) return '#2a74e6'
  return '#9d9d9d'
}
