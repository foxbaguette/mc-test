import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ButtonColor } from '@/components/Button'
import type { Planet } from '@/chain/config'
import { useFavorites, useMaximizerLand } from '@/data/favorites'
import {
  refreshMining,
  useEquippedTools,
  useLandTypes,
  useLivePools,
  useMiner,
  usePlanetMinCommission,
  usePlanetPools,
  useSuggestedLands
} from '@/data/mining'
import { useMembership } from '@/data/player'
import { pickBestLoanTool, refreshToolLoaning, useLoanableTools, useLoanLand, useToolWallet } from '@/data/toolLoaning'
import { tlmToNumber } from '@/lib/format'
import { cooldownLabel, useNow } from '@/lib/time'
import { useSession, type MiningType } from '@/state/session'
import { canMine } from '@/wallet/session'

import {
  bestSuggestedLand,
  effectiveCommission,
  estimateTlm,
  mineReadyAt,
  miningPowerByRarity,
  nextFavoriteUpgrade,
  pickFavoriteLand
} from './estimates'
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

/** State and actions behind the header's mine button. */
export function useMining() {
  const navigate = useNavigate()
  const account = useSession((s) => s.account)
  const permission = useSession((s) => s.permission)
  const miningType = useSession((s) => s.miningType)
  const player = useMembership()
  const miner = useMiner(account)
  const tools = useEquippedTools(account)
  const maximizer = useMaximizerLand(account, miningType === 'blue')
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)

  const isLoan = miningType === 'red'
  const loan = useLoanableTools(isLoan ? account : null)
  const loanWallet = useToolWallet(isLoan ? account : null)
  const loanLandFor = useLoanLand(isLoan)

  const cannotMine = !player.isMember || player.flagged
  // Anchor may sign in but not mine: the button stays off and says why.
  const walletCanMine = useSession((s) => canMine(s.wallet))
  const usesFavorites = miningType === 'green' || miningType === 'orange'
  const favorites = useFavorites(usesFavorites ? account : null)
  // The picks only need to move on every few seconds, not on every clock tick.
  const coarseNow = Math.floor(now / 5000) * 5000

  const bestFavorite = useMemo(
    () =>
      usesFavorites
        ? pickFavoriteLand(
            favorites.lands,
            (land) => mineReadyAt(land.delay, tools.data, miner.data?.last_mine),
            miningType,
            coarseNow
          )
        : null,
    [usesFavorites, favorites.lands, tools.data, miner.data, miningType, coarseNow]
  )

  // A favourite that pays more but is still cooling down: the button moves up to it once it is ready.
  const upgrade = useMemo(
    () =>
      usesFavorites
        ? nextFavoriteUpgrade(
            favorites.lands,
            (land) => mineReadyAt(land.delay, tools.data, miner.data?.last_mine),
            miningType,
            coarseNow
          )
        : null,
    [usesFavorites, favorites.lands, tools.data, miner.data, miningType, coarseNow]
  )

  const bestLoan = useMemo(() => (isLoan ? pickBestLoanTool(loan.tools, coarseNow) : null), [isLoan, loan.tools, coarseNow])

  // What the next mine should pay, on the pools as last read: the current land, the favourite the
  // button would pick, or the Mine Maximizer's best. Loaned tools pay by the loan, so no estimate.
  const estimating = !isLoan && !cannotMine
  const landTypes = useLandTypes(estimating)
  const pools = usePlanetPools(estimating)
  const planetMin = usePlanetMinCommission(estimating)
  const suggested = useSuggestedLands(estimating && miningType === 'blue')
  // The planets this mode's estimate depends on, kept current every few seconds while in view.
  const livePlanets = (
    miningType === 'blue'
      ? (suggested.data ?? []).map((row) => row.planet)
      : usesFavorites
        ? favorites.lands.map((land) => land.planetName)
        : [miner.data?.land.planetName ?? '']
  )
    .filter(Boolean)
    .map((planet) => planet.toLowerCase() as Planet)
  useLivePools(livePlanets, estimating)
  const estimatedTlm = useMemo(() => {
    if (!estimating) return null
    if (usesFavorites) return bestFavorite?.estimatedTlm ?? null
    const power = miningPowerByRarity(tools.data)
    if (miningType === 'blue') {
      if (!suggested.data || !pools.data) return null
      return bestSuggestedLand(power, suggested.data, landTypes.data, pools.data, planetMin.data)?.value ?? null
    }
    const land = miner.data?.land
    if (!land || !pools.data) return null
    const planet = land.planetName?.toLowerCase() as Planet
    const landType = landTypes.data?.find((l) => l.landtype_id === land.cardid)
    const commission = effectiveCommission(land.commission / 10000, planetMin.data?.[planet] ?? 0)
    const gross = estimateTlm(power, landType?.mining_power_mod ?? 0, pools.data[planet])
    return gross - gross * commission
  }, [
    estimating,
    usesFavorites,
    bestFavorite,
    miningType,
    suggested.data,
    pools.data,
    landTypes.data,
    planetMin.data,
    tools.data,
    miner.data
  ])

  const landDelay = miningType === 'blue' ? 15 : usesFavorites ? bestFavorite?.delay : miner.data?.land.delay
  const readyAt = isLoan ? (bestLoan?.readyAt ?? 0) : mineReadyAt(landDelay, tools.data, miner.data?.last_mine)
  const label = cooldownLabel(readyAt, now)
  const dataLoading = isLoan ? loan.isLoading : miner.isLoading || tools.isLoading
  const noLoanTool = isLoan && !loan.isLoading && !bestLoan

  // Play the Alien Worlds chime when the cooldown runs out.
  const previous = useRef(label)
  useEffect(() => {
    if (previous.current !== 'MINE' && label === 'MINE' && !dataLoading && walletCanMine) {
      void new Audio(MINE_SOUND).play().catch(() => undefined)
    }
    previous.current = label
  }, [label, dataLoading, walletCanMine])

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
    if (!account || !walletCanMine) return
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
      landId = (await maximizer.refreshAndPick())?.asset_id
    } else if (usesFavorites) {
      // Scan the pools now and mine where the return is best at this moment, among lands ready.
      const lands = await favorites.estimateNow()
      landId = pickFavoriteLand(
        lands,
        (land) => mineReadyAt(land.delay, tools.data, miner.data?.last_mine),
        miningType,
        Date.now()
      )?.asset_id
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
    : !walletCanMine
      ? 'Unavailable with Anchor'
      : isLoan
        ? 'Tool Loaning'
        : usesFavorites
          ? (bestFavorite?.name ?? '')
          : (miner.data?.land.name ?? '')

  return {
    onClick,
    refresh,
    isBusy: !cannotMine && (busy || dataLoading),
    isDisabled: !cannotMine && (!walletCanMine || busy || dataLoading || noLoanTool || label !== 'MINE'),
    /** Cooldown over and nothing in the way: the moment to press it. */
    isReady: !cannotMine && walletCanMine && !busy && !dataLoading && !noLoanTool && label === 'MINE',
    isRefreshing: miner.isFetching || tools.isFetching || (isLoan && loan.isFetching),
    buttonColor: COLORS[miningType],
    buttonText: cannotMine ? 'Membership' : label,
    textAbove,
    /** TLM the next mine should pay, before any bonus; null where there is no estimate. */
    estimatedTlm,
    /** The better favourite land the button will pick once it comes off cooldown, while it waits. */
    upgrade:
      upgrade && upgrade.at > now
        ? {
            in: cooldownLabel(upgrade.at, now, ''),
            title: `${upgrade.land.name} pays more (${
              miningType === 'orange' ? `${upgrade.land.estimatedTlm.toFixed(4)} TLM` : `${upgrade.land.shards} shards`
            }) and comes off cooldown in ${cooldownLabel(upgrade.at, now, '')}`
          }
        : null,
    textBelow
  }
}
