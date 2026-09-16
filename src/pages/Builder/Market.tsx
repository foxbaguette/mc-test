import { useState } from 'react'

import { Button } from '@/components/Button'
import { RefreshIcon } from '@/components/icons'
import {
  cooldownEnd,
  estimateMcpForDelivery,
  estimateResourcesForQp,
  formatR,
  qpToFillStorage,
  refreshBuilder,
  useBuilderSettings,
  useSwapPool
} from '@/data/builder'
import { usePlayer } from '@/data/player'
import type { BuilderPlayer, PlayerBuilding } from '@/data/types/builder'
import QuestSVG from '@/icons/quest'
import StarSVG from '@/icons/star'
import { cooldownLabel } from '@/lib/time'
import { deliverResourcesAction } from '@/mining/actions'
import { useChainAction } from '@/pages/AwMining/useMemberAction'

import { ConfirmDialog } from './ConfirmDialog'

interface MarketProps {
  player: BuilderPlayer
  building: PlayerBuilding
  resources: number
  now: number
}

interface SpendOption {
  label: string
  qp: number
  fill: boolean
}

/** Spaceport exchanges: Я for MCP, and quest points for Я. */
export function Market({ player, building, resources, now }: MarketProps) {
  const pool = useSwapPool()
  const settings = useBuilderSettings()
  const { rewardPoints } = usePlayer()
  const { run, busy } = useChainAction()
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState<(SpendOption & { resources: number }) | null>(null)

  const value = Number(amount) || 0
  const readyAt = cooldownEnd(building.last_interaction, settings.data?.seconds_market_cd)
  const cooling = readyAt > now
  const locked = building.building_level < 1
  const full = resources >= player.max_gamecurrency

  const fillQp = qpToFillStorage(pool.data, settings.data, resources, player.max_gamecurrency)
  const options: SpendOption[] = [
    { label: 'Spend', qp: 1, fill: false },
    { label: 'Spend', qp: Math.min(Math.floor(fillQp / 2), rewardPoints), fill: false },
    { label: 'Fill Storage', qp: fillQp, fill: true }
  ]
  const estimate = (qp: number) => estimateResourcesForQp(pool.data, settings.data, qp, player.max_gamecurrency)

  async function deliver() {
    if (await run((a, p) => deliverResourcesAction(a, p, value), 'Delivery successful', refreshBuilder)) setAmount('')
  }

  return (
    <>
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title bmarket__title">
            EXCHANGE <span>Я</span> FOR <StarSVG />
          </h2>
          <button
            className={`icon-btn ${pool.isFetching ? 'is-spinning' : ''}`}
            onClick={() => pool.refetch()}
            disabled={pool.isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        <label className="bfield">
          <span className="bfield__label">Я to deliver to Mission Control</span>
          <span className="bfield__row">
            <input
              className="bfield__input num"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
            />
            <button type="button" className="bfield__max" onClick={() => setAmount(String(Math.floor(resources)))}>
              MAX
            </button>
          </span>
        </label>

        <div className="bmarket__estimate">
          <span>
            Estimated <StarSVG />
          </span>
          <strong className="num">~ {estimateMcpForDelivery(pool.data, value, building).toLocaleString('en-US')}</strong>
        </div>

        <Button
          block
          isLoading={busy && !confirm}
          disabled={busy || locked || cooling || value <= 0 || value > resources}
          onClick={deliver}
        >
          <span className="num">{cooling ? cooldownLabel(readyAt, now) : 'DELIVER NOW'}</span>
        </Button>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title bmarket__title">
            EXCHANGE <QuestSVG /> FOR <span>Я</span>
          </h2>
        </div>

        <div className="bspend">
          {options.map((option, i) => (
            <div key={i} className="bspend__opt">
              <Button
                block
                disabled={busy || locked || full || option.qp < 1 || rewardPoints < (option.fill ? option.qp : 1)}
                onClick={() => setConfirm({ ...option, resources: estimate(option.qp) })}
              >
                <span className="bspend__btn">
                  <span>{option.label}</span>
                  <span className="num">
                    ( {option.qp} <QuestSVG /> )
                  </span>
                </span>
              </Button>
              <span className="bspend__est">Estimated Я</span>
              <span className="num">~ {formatR(estimate(option.qp))}</span>
            </div>
          ))}
        </div>
      </section>

      {confirm && (
        <ConfirmDialog qp={confirm.qp} resources={confirm.resources} fill={confirm.fill} onClose={() => setConfirm(null)} />
      )}
    </>
  )
}
