/** Mining data: the miner, their tools, land types and the planet pools. */

import { useQuery } from '@tanstack/react-query'
import { atomic } from '@/chain/atomic'
import { PLANETS, type Planet } from '@/chain/config'
import { tlmToNumber } from '@/lib/format'

import { queryClient } from './queryClient'
import * as t from './tables'
import type { CurrentLand, EquippedTool, LandData, ToolData } from './types/mining'
import { miningKeys } from './keys'

const MIN = 60_000
const HOUR = 60 * MIN

export const useLandTypes = (enabled = true) =>
  useQuery({ queryKey: miningKeys.landTypes, queryFn: t.readLandTypes, staleTime: HOUR, enabled })

export const useAwTools = () => useQuery({ queryKey: miningKeys.awTools, queryFn: t.readAwTools, staleTime: HOUR })

export const useMineTrack = () => useQuery({ queryKey: miningKeys.mineTrack, queryFn: t.readMineTrack, staleTime: 20 * MIN })

/** min_commission per planet, as a fraction (500 -> 0.05). */

export function usePlanetMinCommission(enabled = true) {
  return useQuery({
    queryKey: miningKeys.planetMinCommission,
    staleTime: HOUR,
    enabled,
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

export function usePlanetPools(enabled = true) {
  return useQuery({
    queryKey: miningKeys.planetPools,
    staleTime: 5 * MIN,
    enabled,
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

export function useMiner(account: string | null) {
  return useQuery({
    queryKey: miningKeys.miner(account),
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
    queryKey: miningKeys.equippedTools(account),
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

/** The land suggestions every "best land" estimate starts from. */
export const useSuggestedLands = (enabled = true) =>
  useQuery({ queryKey: miningKeys.suggestedLands, queryFn: t.readSuggestedLands, staleTime: HOUR, enabled })

export function useToolInventory(account: string | null) {
  return useQuery({
    queryKey: miningKeys.toolInventory(account),
    enabled: !!account,
    staleTime: HOUR,
    queryFn: () =>
      atomic.getOwnedAssets<ToolData>({ owner: account!, collection_name: 'alien.worlds', schema_name: 'tool.worlds' })
  })
}

export function refreshMining(account: string | null) {
  return Promise.all(
    [miningKeys.miner(account), miningKeys.equippedTools(account), miningKeys.favorites(account)].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}
