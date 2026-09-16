import { useMemo } from 'react'

import { evaluateSuggestedLands, miningPowerByRarity, topLandEstimate } from '@/mining/estimates'

import {
  refreshMining,
  useEquippedTools,
  useLandTypes,
  usePlanetMinCommission,
  usePlanetPools,
  useSuggestedLands
} from './mining'

/** Every planet's suggested land with its estimated TLM per mine for the equipped tools, and the best of them. */
export function useMaximizerPlanets(account: string | null) {
  const tools = useEquippedTools(account)
  const landTypes = useLandTypes()
  const pools = usePlanetPools()
  const planetMin = usePlanetMinCommission()
  const suggested = useSuggestedLands()

  const planets = useMemo(
    () =>
      evaluateSuggestedLands(miningPowerByRarity(tools.data), suggested.data ?? [], landTypes.data, pools.data, planetMin.data),
    [tools.data, suggested.data, landTypes.data, pools.data, planetMin.data]
  )

  /** Reads the current pools again and returns the best land for them, as the original did right before mining. */
  async function refreshAndPick() {
    const [freshSuggested, freshPools] = await Promise.all([suggested.refetch(), pools.refetch()])
    const estimates = evaluateSuggestedLands(
      miningPowerByRarity(tools.data),
      freshSuggested.data ?? [],
      landTypes.data,
      freshPools.data,
      planetMin.data
    )
    return topLandEstimate(estimates)?.row.asset_id
  }

  return {
    planets,
    best: topLandEstimate(planets),
    tools,
    isLoading: suggested.isLoading || pools.isLoading || landTypes.isLoading || tools.isLoading,
    isFetching: suggested.isFetching || pools.isFetching || tools.isFetching,
    refresh: () => Promise.all([suggested.refetch(), pools.refetch(), refreshMining(account)]),
    refreshAndPick
  }
}
