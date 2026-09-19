import type { Planet } from '@/chain/config'
import type { FavoriteLand } from '@/data/favorites'
import type { EquippedTool, LandType, SuggestedLand } from '@/data/types/mining'
import { chainDate } from '@/lib/time'
import type { MiningType } from '@/state/session'

/**
 * When the equipped bag can mine again, the way the original header computed it:
 * the land's delay attribute (10 = 1x) scales the tool delays, where only the
 * slowest tool counts fully, the second counts half with two tools, and fully
 * with three.
 */
export function mineReadyAt(landDelay: number | undefined, tools: EquippedTool[] | undefined, lastMine?: string): number {
  const multiplier = (landDelay ?? 0) / 10
  const delays = (tools ?? []).map((tool) => tool.delay ?? 0).sort((a, b) => b - a)

  let seconds = 0
  if (delays.length === 1) seconds = multiplier * delays[0]
  else if (delays.length === 2) seconds = multiplier * (delays[0] + delays[1] / 2)
  else if (delays.length >= 3) seconds = multiplier * (delays[0] + delays[1])

  const lastToolUse = Math.max(0, ...(tools ?? []).map((tool) => (tool.last_use ?? 0) * 1000))
  const lastMineAt = lastMine ? +chainDate(lastMine) : 0
  const last = Math.max(lastToolUse, Number.isFinite(lastMineAt) ? lastMineAt : 0)

  return last + seconds * 1000
}

/** Mining power per rarity across the equipped tools. */
export function miningPowerByRarity(tools: EquippedTool[] | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const tool of tools ?? []) out[tool.rarity] = (out[tool.rarity] ?? 0) + Number(tool.mining_power ?? 0)
  return out
}

/** Expected TLM per mine before commission: each rarity share is capped at 80% of that planet's pool bucket. */
export function estimateTlm(
  powerByRarity: Record<string, number>,
  landMiningPowerMod: number,
  pools: Record<string, number> | undefined
) {
  if (!pools) return 0
  return Object.entries(powerByRarity).reduce((sum, [rarity, power]) => {
    const share = Math.min(0.8, (power * landMiningPowerMod) / 10000)
    return sum + share * (pools[rarity] ?? 0)
  }, 0)
}

/** Commission is never below the planet minimum. Both are fractions. */
export const effectiveCommission = (landCommission: number, planetMin: number) => Math.max(landCommission, planetMin)

export function estimateShards(tools: EquippedTool[] | undefined, landType: LandType | undefined) {
  const nftPower = (tools ?? []).reduce((sum, tool) => sum + Number(tool.nft_power ?? 0), 0)
  return (nftPower * (landType?.nft_power_mod ?? 0)) / 100
}

export function estimateMcp(tools: EquippedTool[] | undefined, luck: number) {
  const nftPower = (tools ?? []).reduce((sum, tool) => sum + Number(tool.nft_power ?? 0), 0)
  return nftPower * (luck / 10)
}

export interface LandEstimate {
  row: SuggestedLand
  /** Estimated TLM per mine after commission. */
  value: number
}

type PlanetPoolMap = Partial<Record<Planet, Record<string, number>>> | undefined
type PlanetMinMap = Partial<Record<Planet, number>> | undefined

/** Estimated TLM after commission on each suggested land (one per planet, missions.mc `lands`). */
export function evaluateSuggestedLands(
  powerByRarity: Record<string, number>,
  rows: SuggestedLand[],
  landTypes: LandType[] | undefined,
  pools: PlanetPoolMap,
  planetMin: PlanetMinMap
): LandEstimate[] {
  return rows.map((row) => {
    const planet = row.planet.toLowerCase() as Planet
    const landType = landTypes?.find((l) => l.landname === row.land_name)
    const commission = effectiveCommission(Number(row.comission ?? 0) / 10000, planetMin?.[planet] ?? 0)
    const gross = estimateTlm(powerByRarity, landType?.mining_power_mod ?? 0, pools?.[planet])
    return { row, value: gross - gross * commission }
  })
}

/** The estimate that pays the most, or null for an empty list. */
export const topLandEstimate = (estimates: LandEstimate[]) =>
  estimates.reduce<LandEstimate | null>((top, estimate) => (!top || estimate.value > top.value ? estimate : top), null)

/**
 * The suggested land that pays the most TLM after commission for the given
 * mining power per rarity. Used by the Mine Maximizer and by Tool Loaning.
 */
export function bestSuggestedLand(
  powerByRarity: Record<string, number>,
  rows: SuggestedLand[],
  landTypes: LandType[] | undefined,
  pools: PlanetPoolMap,
  planetMin: PlanetMinMap
): { asset_id: string; value: number } | null {
  const top = topLandEstimate(evaluateSuggestedLands(powerByRarity, rows, landTypes, pools, planetMin))
  return top ? { asset_id: top.row.asset_id, value: top.value } : null
}

/** The favorite land to mine next: ready lands first, then by shards (green) or TLM (orange). */
export function pickFavoriteLand(lands: FavoriteLand[], readyAt: (land: FavoriteLand) => number, type: MiningType, now: number) {
  if (lands.length === 0) return null
  let pool = lands.filter((land) => readyAt(land) <= now)
  if (pool.length === 0) {
    const soonest = Math.min(...lands.map(readyAt))
    pool = lands.filter((land) => readyAt(land) === soonest)
  }
  const primary = (land: FavoriteLand) => (type === 'orange' ? land.estimatedTlm : land.shards)
  const secondary = (land: FavoriteLand) => (type === 'orange' ? land.shards : land.estimatedTlm)
  return [...pool].sort((a, b) => primary(b) - primary(a) || secondary(b) - secondary(a))[0]
}

export type LandSort = 'ready' | 'tlm' | 'shards'

/**
 * Favourite lands in the order the player chose. Lands ready to mine always come first. "Ready
 * first" then goes by cooldown (longest-cooling ready lands first, then the soonest to be ready);
 * the estimate orders put the best estimate first within each group, ties going to the other one.
 */
export function sortFavoriteLands<T extends { land: FavoriteLand; isReady: boolean }>(lands: T[], sort: LandSort): T[] {
  const ready = lands.filter((l) => l.isReady).sort((a, b) => b.land.delay - a.land.delay)
  const waiting = lands.filter((l) => !l.isReady).sort((a, b) => a.land.delay - b.land.delay)
  if (sort === 'ready') return [...ready, ...waiting]
  const byEstimate = (a: T, b: T) =>
    sort === 'tlm'
      ? b.land.estimatedTlm - a.land.estimatedTlm || b.land.shards - a.land.shards
      : b.land.shards - a.land.shards || b.land.estimatedTlm - a.land.estimatedTlm
  return [...ready.sort(byEstimate), ...waiting.sort(byEstimate)]
}
