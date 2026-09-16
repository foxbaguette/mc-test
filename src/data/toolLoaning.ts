import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import { RARITY_ORDER } from '@/chain/config'
import { tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'
import { bestSuggestedLand } from '@/mining/estimates'

import { queryClient } from './queryClient'
import { useLandTypes, useMiner, usePlanetMinCommission, usePlanetPools, useUserPoints } from './queries'
import { readMinerClaim, readMTools, readStakedTools, readSuggestedLands, readToolOv, readToolWallet } from './tables'
import type { MTool, ToolOv, ToolWallet } from './types'

const MIN = 60_000

export const KOL_DIGGER = 'Certified Kol Digger'
/** The land every Certified Kol Digger loan mines on (as the original site did). */
export const KOL_DIGGER_LAND = '1099512958237'

export const SHINE_ORDER: Record<string, number> = { 'X-Dimension': 0, Antimatter: 1, Stardust: 2, Gold: 3, Stone: 4 }

export const useToolOv = (enabled = true) =>
  useQuery({ queryKey: ['toolOv'], queryFn: readToolOv, staleTime: MIN, enabled })

export const useMTools = (enabled = true) =>
  useQuery({ queryKey: ['mtools'], queryFn: readMTools, staleTime: MIN, enabled })

export const useToolWallet = (account: string | null) =>
  useQuery({ queryKey: ['toolWallet', account], queryFn: () => readToolWallet(account!), enabled: !!account, staleTime: MIN })

export const useStakedTools = (account: string | null) =>
  useQuery({ queryKey: ['stakedTools', account], queryFn: () => readStakedTools(account!), enabled: !!account, staleTime: MIN })

export const useMinerClaim = (account: string | null) =>
  useQuery({ queryKey: ['minerClaim', account], queryFn: () => readMinerClaim(account!), enabled: !!account, staleTime: MIN, refetchInterval: MIN })

export function refreshToolLoaning(account: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['toolOv'] }),
    queryClient.invalidateQueries({ queryKey: ['mtools'] }),
    queryClient.invalidateQueries({ queryKey: ['toolWallet', account] }),
    queryClient.invalidateQueries({ queryKey: ['stakedTools', account] }),
    queryClient.invalidateQueries({ queryKey: ['minerClaim', account] }),
    queryClient.invalidateQueries({ queryKey: ['miner', account] })
  ])
}

/** A trial account shows its trial TLM as a negative deposit until real TLM is deposited. */
export function depositState(wallet: ToolWallet | null | undefined) {
  const deposit = tlmToNumber(wallet?.deposit)
  const trial = tlmToNumber(wallet?.trialtlm)
  const negative = deposit === 0 && trial > 0
  return { value: deposit, trial, negative, text: negative ? `- ${trial.toFixed(4)}` : deposit.toFixed(4) }
}

/** Loanable rarities unlock with the player's Alien Worlds points (uspts.worlds total_points). */
export function levelAllows(totalPoints: number, tool: Pick<ToolOv, 'tool_name' | 'rarity'>) {
  if (totalPoints < 2840) return tool.tool_name === KOL_DIGGER
  if (tool.tool_name === KOL_DIGGER) return false
  const rank = RARITY_ORDER[tool.rarity] ?? 99
  if (totalPoints < 9650) return rank >= 3
  if (totalPoints < 28430) return rank >= 2
  if (totalPoints < 78530) return rank >= 1
  return rank >= 0
}

export interface LoanTool extends ToolOv {
  /** When this tool can be mined with again. */
  readyAt: number
  /** Whether the wait comes from the player's own last mine or from the tool's cooldown. */
  blockedBy: 'miner' | 'tool'
  mtool?: MTool
}

/** The tools this player may loan right now, with their cooldowns, sorted by rarity then shine. */
export function useLoanableTools(account: string | null) {
  const enabled = !!account
  const toolOv = useToolOv(enabled)
  const mtools = useMTools(enabled)
  const wallet = useToolWallet(account)
  const points = useUserPoints(account)
  const miner = useMiner(account)

  const tools = useMemo<LoanTool[]>(() => {
    const allowList = wallet.data?.tempid_allow_list ?? []
    const totalPoints = points.data?.total_points ?? 0
    const lastMine = miner.data?.last_mine ? +chainDate(miner.data.last_mine) : 0
    const soonestMTool = [...(mtools.data ?? [])].sort((a, b) => +chainDate(a.readyat) - +chainDate(b.readyat))[0]

    return (toolOv.data ?? [])
      .filter((tool) => {
        const isKol = tool.tool_name === KOL_DIGGER
        if (tool.owned <= 0 || (!isKol && tool.allowed !== 1)) return false
        if (!levelAllows(totalPoints, tool)) return false
        if (isKol && !soonestMTool) return false
        return allowList.length === 0 || allowList.includes(tool.template_id)
      })
      .map((tool) => {
        const isKol = tool.tool_name === KOL_DIGGER
        const source = isKol ? soonestMTool! : tool
        const lastUse = +chainDate(source.readyat) - source.cooldown_seconds * 1000
        const delay = (isKol ? 500 : tool.cooldown_seconds) * 1.5 * 1000
        return {
          ...tool,
          mtool: isKol ? soonestMTool : undefined,
          readyAt: Math.max(lastMine, lastUse) + delay,
          blockedBy: lastMine > lastUse ? ('miner' as const) : ('tool' as const)
        }
      })
      .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99) || (SHINE_ORDER[a.shine] ?? 9) - (SHINE_ORDER[b.shine] ?? 9))
  }, [toolOv.data, mtools.data, wallet.data, points.data, miner.data])

  return {
    tools,
    isLoading: toolOv.isLoading || wallet.isLoading || points.isLoading || miner.isLoading,
    isFetching: toolOv.isFetching || wallet.isFetching || mtools.isFetching || miner.isFetching
  }
}

/** Best tool for the header's Tool Loaning button: a ready tool of the highest rarity and power, else the soonest. */
export function pickBestLoanTool(tools: LoanTool[], now: number): LoanTool | null {
  if (tools.length === 0) return null
  const ready = tools.filter((tool) => tool.readyAt <= now)
  if (ready.length > 0) {
    return [...ready].sort((a, b) => (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99) || b.mining_power - a.mining_power)[0]
  }
  return [...tools].sort((a, b) => a.readyAt - b.readyAt)[0]
}

/** Returns a function giving the best suggested land for a single loaned tool. */
export function useLoanLand(enabled = true) {
  const suggested = useQuery({ queryKey: ['suggestedLands'], queryFn: readSuggestedLands, staleTime: 60 * MIN, enabled })
  const landTypes = useLandTypes()
  const pools = usePlanetPools()
  const planetMin = usePlanetMinCommission()

  return useCallback(
    (tool: Pick<ToolOv, 'rarity' | 'mining_power'>) =>
      bestSuggestedLand({ [tool.rarity]: tool.mining_power }, suggested.data ?? [], landTypes.data, pools.data, planetMin.data)?.asset_id,
    [suggested.data, landTypes.data, pools.data, planetMin.data]
  )
}
