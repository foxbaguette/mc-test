import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

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

import { useEquippedTools, useLandTypes, usePlanetMinCommission, usePlanetPools, useSuggestedLands } from './mining'
import { useMember } from './player'
import type { CurrentLand, LandData, ToolData } from './types/mining'
import { miningKeys } from './keys'

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

/**
 * Favorite lands and tool sets stored in the member's `usrsettings`. Pass null as the account
 * to skip loading, e.g. when the top bar isn't in a favorites mode.
 */
export function useFavorites(account: string | null) {
  const enabled = !!account
  const member = useMember(account)
  const tools = useEquippedTools(account)
  const landTypes = useLandTypes(enabled)
  const pools = usePlanetPools(enabled)
  const planetMin = usePlanetMinCommission(enabled)

  const settings = member.data?.usrsettings ?? []
  const landIds = settings
    .filter((s) => s.key.includes('land'))
    .flatMap((s) => s.value.split(','))
    .filter(Boolean)
  const toolSets = settings
    .filter((s) => s.key.includes('toolset'))
    .map((s) => ({ value: s.value, assetIds: s.value.split(',').filter(Boolean) }))
    .filter((s) => s.assetIds.length > 0)

  const assets = useQuery({
    queryKey: miningKeys.favorites(account, landIds.join(','), toolSets.map((s) => s.value).join('|')),
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

  // The estimates from the pools as they stand in `poolData`: the loaded ones for the list, freshly
  // read ones when the mine button picks a land.
  const estimate = (poolData: typeof pools.data): FavoriteLand[] => {
    const power = miningPowerByRarity(tools.data)
    return landIds.flatMap((id) => {
      const asset = assets.data?.lands.find((a) => a.asset_id === id)
      if (!asset) return []
      const [landName, planetName] = asset.data.name.split(' on ')
      const planet = planetName?.toLowerCase() as Planet
      const landType = landTypes.data?.find((l) => l.landtype_id === asset.data.cardid)
      const commission = effectiveCommission(asset.data.commission / 10000, planetMin.data?.[planet] ?? 0)
      const gross = estimateTlm(power, landType?.mining_power_mod ?? 0, poolData?.[planet])
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
  }

  return useMemo(() => {
    const lands = estimate(pools.data)

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
      refetch: () => Promise.all([member.refetch(), assets.refetch()]),
      /**
       * The lands estimated on the planets' pools as they are right now: the mine button reads the
       * pools again when clicked, so it mines where the return is best at that moment.
       */
      estimateNow: async () => estimate((await pools.refetch()).data)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assets.data,
    assets.isLoading,
    assets.isFetching,
    member.data,
    member.isLoading,
    tools.data,
    landTypes.data,
    pools.data,
    planetMin.data
  ])
}

/**
 * The Mine Maximizer's pick for the top-bar mine button. Nothing is estimated until mining:
 * `refreshAndPick` reads the pools again and returns the best suggested land for the equipped tools.
 */
export function useMaximizerLand(account: string | null, enabled: boolean) {
  const tools = useEquippedTools(account)
  const landTypes = useLandTypes(enabled)
  const pools = usePlanetPools(enabled)
  const planetMin = usePlanetMinCommission(enabled)
  const suggested = useSuggestedLands(enabled)

  const toolData = tools.data
  const landTypeData = landTypes.data
  const planetMinData = planetMin.data
  const refetchSuggested = suggested.refetch
  const refetchPools = pools.refetch

  const refreshAndPick = useCallback(async () => {
    const [freshSuggested, freshPools] = await Promise.all([refetchSuggested(), refetchPools()])
    return bestSuggestedLand(
      miningPowerByRarity(toolData),
      freshSuggested.data ?? [],
      landTypeData,
      freshPools.data,
      planetMinData
    )
  }, [refetchSuggested, refetchPools, toolData, landTypeData, planetMinData])

  return { refreshAndPick }
}
