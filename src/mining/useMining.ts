import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ButtonColor } from '@/components/Button'
import { useFavorites, useMaximizerLand, type FavoriteLand } from '@/data/favorites'
import { refreshMining, useEquippedTools, useMiner, usePlayer } from '@/data/queries'
import { pickBestLoanTool, refreshToolLoaning, useLoanableTools, useLoanLand, useToolWallet } from '@/data/toolLoaning'
import { tlmToNumber } from '@/lib/format'
import { cooldownLabel, useNow } from '@/lib/time'
import { useSession, type MiningType } from '@/state/session'

import { mineReadyAt } from './estimates'
import { mineWithLoanedTool } from './loan'
import { mineNow } from './mineNow'

const MINE_SOUND = 'https://play.alienworlds.io/sounds/aw-mining-claim-sfx-02.mp3'

export const COLORS: Record<MiningType, ButtonColor> = {
  gold: 'gradientYellow',
  green: 'gradientGreen',
  orange: 'gradientOrange',
  blue: 'gradientBlue',
  red: 'gradientRed'
}

const ABOVE: Record<MiningType, string> = {
  gold: 'Mining',
  green: 'Favorites (shards)',
  orange: 'Favorites (TLM)',
  blue: 'Mine Maximizer',
  red: 'Tool Loaning'
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

/** State and actions behind the header's mine button. */
export function useMining() {
  const navigate = useNavigate()
  const account = useSession((s) => s.account)
  const permission = useSession((s) => s.permission)
  const miningType = useSession((s) => s.miningType)
  const player = usePlayer()
  const miner = useMiner(account)
  const tools = useEquippedTools(account)
  const favorites = useFavorites(account)
  const maximizer = useMaximizerLand(account, miningType === 'blue')
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)

  const isLoan = miningType === 'red'
  const loan = useLoanableTools(isLoan ? account : null)
  const loanWallet = useToolWallet(isLoan ? account : null)
  const loanLandFor = useLoanLand(isLoan)

  const cannotMine = !player.isMember || player.flagged
  const usesFavorites = miningType === 'green' || miningType === 'orange'
  const tick = Math.floor(now / 5000)

  const bestFavorite = useMemo(
    () =>
      usesFavorites
        ? pickFavoriteLand(favorites.lands, (land) => mineReadyAt(land.delay, tools.data, miner.data?.last_mine), miningType, Date.now())
        : null,
    [usesFavorites, favorites.lands, tools.data, miner.data, miningType, tick]
  )

  const bestLoan = useMemo(() => (isLoan ? pickBestLoanTool(loan.tools, Date.now()) : null), [isLoan, loan.tools, tick])

  const landDelay = miningType === 'blue' ? 15 : usesFavorites ? bestFavorite?.delay : miner.data?.land.delay
  const readyAt = isLoan ? (bestLoan?.readyAt ?? 0) : mineReadyAt(landDelay, tools.data, miner.data?.last_mine)
  const label = cooldownLabel(readyAt, now)
  const dataLoading = isLoan ? loan.isLoading : miner.isLoading || tools.isLoading
  const noLoanTool = isLoan && !loan.isLoading && !bestLoan

  // Play the Alien Worlds chime when the cooldown runs out.
  const previous = useRef(label)
  useEffect(() => {
    if (previous.current !== 'MINE' && label === 'MINE' && !dataLoading) {
      void new Audio(MINE_SOUND).play().catch(() => undefined)
    }
    previous.current = label
  }, [label, dataLoading])

  async function refresh() {
    await Promise.all([
      refreshMining(account),
      usesFavorites ? favorites.refetch() : null,
      isLoan ? refreshToolLoaning(account) : null
    ])
  }

  async function onClick() {
    if (cannotMine) {
      navigate('/membership')
      return
    }
    if (!account) return
    setBusy(true)

    if (isLoan) {
      if (bestLoan) {
        await mineWithLoanedTool({
          account,
          permission,
          tool: bestLoan,
          bagIds: (tools.data ?? []).map((t) => t.asset_id),
          landId: loanLandFor(bestLoan)
        })
      }
      setBusy(false)
      return
    }

    let landId: string | undefined
    if (miningType === 'blue') {
      await maximizer.refetch()
      landId = maximizer.best?.asset_id
    } else if (usesFavorites) {
      landId = bestFavorite?.asset_id
    }
    await mineNow({ account, permission, tools: tools.data, landId })
    setBusy(false)
  }

  const textAbove = cannotMine
    ? 'Not a Member'
    : isLoan
      ? `Deposit: ${tlmToNumber(loanWallet.data?.deposit).toFixed(4)} TLM`
      : ABOVE[miningType]

  const textBelow = cannotMine
    ? 'Become a member to use mine'
    : isLoan
      ? 'Tool Loaning'
      : usesFavorites
        ? (bestFavorite?.name ?? '')
        : (miner.data?.land.name ?? '')

  return {
    onClick,
    refresh,
    isBusy: !cannotMine && (busy || dataLoading),
    isDisabled: !cannotMine && (busy || dataLoading || noLoanTool || label !== 'MINE'),
    /** Cooldown over and nothing in the way: the moment to press it. */
    isReady: !cannotMine && !busy && !dataLoading && !noLoanTool && label === 'MINE',
    isRefreshing: miner.isFetching || tools.isFetching || (isLoan && loan.isFetching),
    buttonColor: COLORS[miningType],
    buttonText: cannotMine ? 'Membership' : label,
    textAbove,
    textBelow
  }
}
