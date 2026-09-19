import { useEffect, useState, type ReactNode } from 'react'
import type { AnyAction } from '@wharfkit/session'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { Ticking } from '@/components/Ticking'
import { PageHeader } from '@/components/PageHeader'
import { usePlayer } from '@/data/player'
import { refreshToolLoaning, useMinerClaim, useToolWallet } from '@/data/toolLoaning'
import { refreshVault, useClaimableWeeks, useLandComms, useLandPayouts } from '@/data/vault'
import InformationSvgBuilder from '@/icons/info-builder'
import LandSVG from '@/icons/land'
import PickaxeSVG from '@/icons/pickaxe'
import QuestSVG from '@/icons/quest'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import TrophySVG from '@/icons/trophy'
import { tlmToNumber } from '@/lib/format'
import { chainDate, compactWait, formatDateTimeShort, timeLeft, useClockFor } from '@/lib/time'
import {
  claimCommsAction,
  claimPayoutAction,
  claimWeeksActions,
  storeRewardPointsAction,
  withdrawRewardPointsAction
} from '@/chain/actions/rewards'
import { claimMinesAction } from '@/chain/actions/mining'
import { claimToolsTlmAction } from '@/chain/actions/toolLoaning'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'

import './TriliumVault.css'

export default function TriliumVault() {
  const { run: sign, pending, account, permission } = useTransaction()
  const player = usePlayer()
  const minerClaim = useMinerClaim(account)
  const landComms = useLandComms(account)
  const payouts = useLandPayouts(account)
  const weeks = useClaimableWeeks()
  const toolWallet = useToolWallet(account)

  const [withdrawQp, setWithdrawQp] = useState('0')
  const [depositQp, setDepositQp] = useState('0')
  const [confirmDeposit, setConfirmDeposit] = useState(false)

  const rewardPoints = player.rewardPoints
  useEffect(() => setDepositQp(String(rewardPoints)), [rewardPoints])

  const mineAmount = tlmToNumber(minerClaim.data?.amount)
  const mineReadyAt = minerClaim.data ? +chainDate(minerClaim.data.timestamp) : 0
  // Re-render once, when the mining rewards unlock; the countdown ticks on its own.
  const now = useClockFor([mineReadyAt])
  const mineWaiting = mineReadyAt > now
  const commsAmount = tlmToNumber(landComms.data?.comms)
  const payoutAmount = tlmToNumber(payouts.data?.payoutAmount)
  const storedPoints = player.member?.score_nft ?? 0
  // A trial balance runs below zero until real TLM is deposited: nothing to claim then.
  const toolDeposit = Math.max(0, tlmToNumber(toolWallet.data?.deposit))

  // Everything that can be collected right now, and the one transaction that takes it all.
  const mineReady = mineAmount > 0 && !mineWaiting
  const totalReady = (mineReady ? mineAmount : 0) + commsAmount + payoutAmount + weeks.total
  const claimAll: AnyAction[] = account
    ? [
        ...(mineReady ? [claimMinesAction(account, permission)] : []),
        ...(commsAmount > 0 ? [claimCommsAction(account, permission)] : []),
        ...(payoutAmount > 0 ? [claimPayoutAction(account, permission)] : []),
        ...(weeks.total > 0 ? claimWeeksActions(account, permission, weeks.weekIds) : [])
      ]
    : []

  // Claimed rows disappear from the tables, so the vault is read again once the chain has them.
  const run = (key: string, actions: AnyAction[], success: string) =>
    sign(
      () => actions,
      success,
      () => refreshVault(account),
      key
    )

  return (
    <>
      <PageHeader title="The Vault" image={publicUrl('/assets/background/bg-the-vault.webp')} />

      <div className="page vault plates">
        <section className={`vault__summary ${totalReady > 0 ? 'is-ready' : ''}`}>
          <div className="vault__summary-data">
            <p className="vault__summary-label">Claimable now</p>
            <p className="vault__summary-value num">
              {totalReady.toFixed(4)} <TLMSVG />
            </p>
          </div>
          <Button
            isLoading={pending === 'all'}
            disabled={!!pending || claimAll.length === 0}
            onClick={() => run('all', claimAll, 'TLM Claimed')}
          >
            Claim All
          </Button>
        </section>

        <div className="vault__grid">
          <VaultCard
            accent="gold"
            icon={<PickaxeSVG />}
            title="Alien Worlds Mining Rewards"
            amount={mineAmount.toFixed(4)}
            unit={<TLMSVG />}
            ready={mineReady}
            info={
              <>
                Earned by mining in Alien Worlds
                {mineWaiting && minerClaim.data && (
                  <>
                    <br />
                    {`Available on ${formatDateTimeShort(chainDate(minerClaim.data.timestamp))}`}
                  </>
                )}
              </>
            }
            action={
              <Button
                block
                size="sm"
                isLoading={pending === 'mines'}
                disabled={!!pending || mineAmount === 0 || mineWaiting}
                onClick={() => run('mines', [claimMinesAction(account!, permission)], 'TLM Claimed')}
              >
                <span className="num">
                  {mineWaiting ? <Ticking render={(tick) => compactWait(timeLeft(mineReadyAt, tick))} /> : 'Claim'}
                </span>
              </Button>
            }
          />

          <VaultCard
            accent="teal"
            icon={<LandSVG />}
            title="Alien Worlds Land Commission"
            amount={commsAmount.toFixed(4)}
            unit={<TLMSVG />}
            ready={commsAmount > 0}
            info="Rewarded when others mine your land"
            action={
              <Button
                block
                size="sm"
                isLoading={pending === 'comms'}
                disabled={!!pending || commsAmount === 0}
                onClick={() => run('comms', [claimCommsAction(account!, permission)], 'TLM Claimed')}
              >
                Claim
              </Button>
            }
          />

          <VaultCard
            accent="violet"
            icon={<LandSVG />}
            title="Alien Worlds DTAL"
            amount={payoutAmount.toFixed(4)}
            unit={<TLMSVG />}
            ready={payoutAmount > 0}
            info="Earned daily by owning lands in Alien Worlds"
            action={
              <Button
                block
                size="sm"
                isLoading={pending === 'payout'}
                disabled={!!pending || payoutAmount === 0}
                onClick={() => run('payout', [claimPayoutAction(account!, permission)], 'TLM Claimed')}
              >
                Claim
              </Button>
            }
          />

          <VaultCard
            accent="pink"
            icon={<TrophySVG />}
            title="Mission Control Weekly Rewards"
            amount={weeks.total.toFixed(4)}
            unit={<TLMSVG />}
            ready={weeks.total > 0}
            info={
              <>
                Earned by playing Mission Control, costs <StarSVG /> to claim
              </>
            }
            action={
              <Button
                block
                size="sm"
                isLoading={pending === 'weeks'}
                disabled={!!pending || weeks.total === 0}
                onClick={() => run('weeks', claimWeeksActions(account!, permission, weeks.weekIds), 'Claim successfully')}
              >
                Claim
              </Button>
            }
          />

          {/* Claimed on its own: the deposit pays for loaned tools, so Claim All leaves it where it is. */}
          <VaultCard
            accent="blue"
            className="vault-card--tools"
            icon={<PickaxeSVG />}
            title="Tool Loaning Deposit"
            amount={toolDeposit.toFixed(4)}
            unit={<TLMSVG />}
            ready={toolDeposit > 0}
            info="TLM you deposited for Tool Loaning"
            action={
              <Button
                block
                size="sm"
                isLoading={pending === 'tools'}
                disabled={!!pending || toolDeposit <= 0}
                onClick={() =>
                  sign(
                    (a, p) => [claimToolsTlmAction(a, p, toolDeposit)],
                    'TLM Claimed',
                    () => Promise.all([refreshVault(account), refreshToolLoaning(account)]),
                    'tools'
                  )
                }
              >
                Claim
              </Button>
            }
          />

          <VaultCard
            wide
            accent="green"
            icon={<QuestSVG />}
            title="Reward Point Deposit"
            amount={String(storedPoints)}
            unit={<QuestSVG />}
            onAmountClick={() => setWithdrawQp(String(storedPoints))}
            info={
              <>
                Reward Points you deposited at an earlier date
                <br />
                Deposit Reward Points for later use. There is a 10% fee when depositing.
              </>
            }
            action={
              <div className="vault__qp">
                <div className="vault__qp-row">
                  <input
                    className="input vault__input num"
                    inputMode="numeric"
                    aria-label="Reward Points to withdraw"
                    value={withdrawQp}
                    onChange={(e) => setWithdrawQp(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button
                    size="sm"
                    isLoading={pending === 'withdrawQp'}
                    disabled={!!pending || !player.isMember || Number(withdrawQp) <= 0}
                    onClick={() =>
                      run(
                        'withdrawQp',
                        [withdrawRewardPointsAction(account!, permission, Number(withdrawQp))],
                        'Successfully withdrawn'
                      )
                    }
                  >
                    Withdraw
                  </Button>
                </div>
                <div className="vault__qp-row">
                  <input
                    className="input vault__input num"
                    inputMode="numeric"
                    aria-label="Reward Points to deposit"
                    value={depositQp}
                    onChange={(e) => setDepositQp(e.target.value.replace(/\D/g, ''))}
                  />
                  <Button
                    size="sm"
                    disabled={!!pending || !player.isMember || Number(depositQp) <= 0}
                    onClick={() => setConfirmDeposit(true)}
                  >
                    Deposit
                  </Button>
                </div>
              </div>
            }
          />
        </div>
      </div>

      {confirmDeposit && (
        <DepositDialog
          points={Number(depositQp)}
          busy={pending === 'depositQp'}
          onClose={() => setConfirmDeposit(false)}
          onConfirm={async () => {
            await run('depositQp', [storeRewardPointsAction(account!, permission, Number(depositQp))], 'Successfully deposited')
            setConfirmDeposit(false)
          }}
        />
      )}
    </>
  )
}

interface CardProps {
  accent: 'gold' | 'teal' | 'violet' | 'pink' | 'green' | 'blue'
  className?: string
  icon: ReactNode
  title: string
  amount: string
  unit: ReactNode
  info: ReactNode
  action: ReactNode
  /** Something is waiting to be collected: the card lights up. */
  ready?: boolean
  wide?: boolean
  onAmountClick?: () => void
}

function VaultCard({ accent, className = '', icon, title, amount, unit, info, action, ready, wide, onAmountClick }: CardProps) {
  const value = (
    <>
      <span className="vault-card__amount num">{amount}</span>
      <span className="vault-card__unit">{unit}</span>
    </>
  )

  return (
    <section
      className={`vault-card vault-card--${accent} ${className} ${ready ? 'is-ready' : ''} ${wide ? 'vault-card--wide' : ''}`}
    >
      <header className="vault-card__head">
        <span className="vault-card__icon">{icon}</span>
        <h2 className="vault-card__title">{title}</h2>
      </header>

      {onAmountClick ? (
        <button className="vault-card__value vault-card__value--button" onClick={onAmountClick}>
          {value}
        </button>
      ) : (
        <p className="vault-card__value">{value}</p>
      )}

      <div className="vault-card__action">{action}</div>

      <p className="vault-card__info">
        <InformationSvgBuilder />
        <span>{info}</span>
      </p>
    </section>
  )
}

interface DepositDialogProps {
  points: number
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}

function DepositDialog({ points, busy, onClose, onConfirm }: DepositDialogProps) {
  const fee = Math.ceil(points * 0.1)

  return (
    <Modal className="vault-dialog plates" locked={busy} onClose={onClose}>
      <div className="vault-dialog__body">
        <button className="icon-btn vault-dialog__close" onClick={onClose} disabled={busy} aria-label="Close">
          ×
        </button>
        <h2 className="vault-dialog__title">Deposit Reward Points</h2>
        <p className="vault-dialog__data num">
          You are about to spend {points} <QuestSVG />
          <br />A {fee} <QuestSVG /> fee (10%) will be applied.
          <br />
          Your vault will receive {points - fee} <QuestSVG />
        </p>
        <p className="vault-dialog__desc">
          Reward Points in your vault will not be automatically converted into TLM rewards at the end of the week and allow you to
          use them at a later date.
        </p>
        <Button block isLoading={busy} disabled={busy} onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </Modal>
  )
}
