import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { atomic } from '@/chain/atomic'
import type { Planet } from '@/chain/config'
import {
  bestSuggestedLand,
  effectiveCommission,
  estimateMcp,
  estimateShards,
  estimateTlm,
  miningPowerByRarity
} from '@/mining/estimates'

import {
  useEquippedTools,
  useLandTypes,
  useMember,
  usePlanetMinCommission,
  usePlanetPools
} from './queries'
import { readSuggestedLands } from './tables'
import type { CurrentLand, LandData, ToolData } from './types'

export interface FavoriteLand extends CurrentLand {
  estimatedTlm: number
  shards: number
  mcp: number
  /** Effective commission as a percentage. */
  commissionPercent: number
}

export interface FavoriteToolSet {
  assetIds: string[]
  /** The raw setting value, needed to remove the set again. */
  value: string
  tools: (ToolData & { asset_id: string; template_id: string })[]
}

/** Favorite lands and tool sets stored in the member's `usrsettings`. */
export function useFavorites(account: string | null) {
  const member = useMember(account)
  const tools = useEquippedTools(account)
  const landTypes = useLandTypes()
  const pools = usePlanetPools()
  const planetMin = usePlanetMinCommission()

  const settings = member.data?.usrsettings ?? []
  const landIds = settings.filter((s) => s.key.includes('land')).flatMap((s) => s.value.split(',')).filter(Boolean)
  const toolSets = settings
    .filter((s) => s.key.includes('toolset'))
    .map((s) => ({ value: s.value, assetIds: s.value.split(',').filter(Boolean) }))
    .filter((s) => s.assetIds.length > 0)

  const assets = useQuery({
    queryKey: ['favorites', account, landIds.join(','), toolSets.map((s) => s.value).join('|')],
    enabled: !!account && member.isSuccess,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const [lands, toolAssets] = await Promise.all([
        atomic.getAssetsByIds<LandData>(landIds),
        atomic.getAssetsByIds<ToolData>(toolSets.flatMap((s) => s.assetIds))
      ])
      return { lands, toolAssets }
    }
  })

  return useMemo(() => {
    const power = miningPowerByRarity(tools.data)

    const lands: FavoriteLand[] = landIds.flatMap((id) => {
      const asset = assets.data?.lands.find((a) => a.asset_id === id)
      if (!asset) return []
      const [landName, planetName] = asset.data.name.split(' on ')
      const planet = planetName?.toLowerCase() as Planet
      const landType = landTypes.data?.find((l) => l.landtype_id === asset.data.cardid)
      const commission = effectiveCommission(asset.data.commission / 10000, planetMin.data?.[planet] ?? 0)
      const gross = estimateTlm(power, landType?.mining_power_mod ?? 0, pools.data?.[planet])
      return [
        {
          ...asset.data,
          asset_id: id,
          owner: asset.owner,
          landName,
          planetName,
          estimatedTlm: gross - gross * commission,
          shards: estimateShards(tools.data, landType),
          mcp: estimateMcp(tools.data, asset.data.luck),
          commissionPercent: commission * 100
        }
      ]
    })

    const sets: FavoriteToolSet[] = toolSets.map((set) => ({
      ...set,
      tools: set.assetIds.flatMap((id) => {
        const asset = assets.data?.toolAssets.find((a) => a.asset_id === id)
        return asset ? [{ ...asset.data, asset_id: id, template_id: asset.template?.template_id ?? '' }] : []
      })
    }))

    return {
      lands,
      toolSets: sets,
      isLoading: member.isLoading || assets.isLoading,
      isFetching: assets.isFetching || member.isFetching,
      refetch: () => Promise.all([member.refetch(), assets.refetch()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.data, assets.isLoading, assets.isFetching, member.data, member.isLoading, tools.data, landTypes.data, pools.data, planetMin.data])
}

/** Best land for the Mine Maximizer: the suggested land per planet with the highest TLM after commission. */
export function useMaximizerLand(account: string | null, enabled: boolean) {
  const tools = useEquippedTools(account)
  const landTypes = useLandTypes()
  const pools = usePlanetPools()
  const planetMin = usePlanetMinCommission()
  const suggested = useQuery({ queryKey: ['suggestedLands'], queryFn: readSuggestedLands, staleTime: 60 * 60_000, enabled })

  return useMemo(() => {
    const best = bestSuggestedLand(miningPowerByRarity(tools.data), suggested.data ?? [], landTypes.data, pools.data, planetMin.data)
    return { best, refetch: () => Promise.all([suggested.refetch(), pools.refetch()]) }
  }, [suggested, tools.data, landTypes.data, pools, planetMin.data])
}
