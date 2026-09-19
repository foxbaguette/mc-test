import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { CloseIcon, InfoCircleIcon } from '@/icons/ui'
import { refreshPlayer, usePlayer } from '@/data/player'
import { depositState, useMinerClaim, useToolWallet } from '@/data/toolLoaning'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { chainDate, compactWait, timeLeft, useClockFor } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { claimMinesAction } from '@/chain/actions/mining'
import { claimToolsTlmAction, depositToolsTlmAction } from '@/chain/actions/toolLoaning'
import { useTransaction } from '@/wallet/useTransaction'
import { toolLoaningKeys } from '@/data/keys'

import { DepositValue } from './Shared'

/** Everything about the player's TLM, above whatever tab is open: it applies to all of them. */
export function Wallet() {
  const { run, busy, pending, account } = useTransaction()
  const wallet = useToolWallet(account)
  const claim = useMinerClaim(account)
  const [open, setOpen] = useState(false)

  const amount = tlmToNumber(claim.data?.amount)
  const readyAt = claim.data ? +chainDate(claim.data.timestamp) : 0
  // Re-render when the rewards unlock; the countdown in the button ticks on its own.
  const waiting = readyAt > useClockFor([readyAt])

  const claimMines = () =>
    run(claimMinesAction, 'TLM Claimed', () => Promise.all([claim.refetch(), refreshPlayer(account)]), 'claim')

  return (
    <>
      <section className="tl-wallet">
        <div className="tl-plate">
          <span className="tl-plate__label">Deposited TLM</span>
          <span className="tl-plate__value">
            <DepositValue wallet={wallet.data} />
          </span>
          <Button size="sm" className="tl-plate__btn" disabled={busy} onClick={() => setOpen(true)}>
            Deposit
          </Button>
        </div>

        <div className="tl-plate">
          <span className="tl-plate__label">AW Mining Rewards</span>
          <span className="tl-plate__value num is-positive">
            {amount.toFixed(4)} <TLMSVG />
          </span>
          <Button
            size="sm"
            className="tl-plate__btn"
            isLoading={pending === 'claim'}
            disabled={busy || amount === 0 || waiting}
            onClick={claimMines}
          >
            <span className="num">{waiting ? <Ticking render={(tick) => compactWait(timeLeft(readyAt, tick))} /> : 'Claim'}</span>
          </Button>
        </div>
      </section>

      {open && <DepositDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function DepositDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { run, busy, pending, account } = useTransaction()
  const player = usePlayer()
  const wallet = useToolWallet(account)
  const [deposit, setDeposit] = useState('')
  const [withdraw, setWithdraw] = useState('')

  const state = depositState(wallet.data)

  async function submit(event: FormEvent, kind: 'deposit' | 'withdraw') {
    event.preventDefault()
    const value = Number(kind === 'deposit' ? deposit : withdraw)
    if (!(value > 0)) return
    const ok = await run(
      (a, p) => (kind === 'deposit' ? depositToolsTlmAction(a, p, value) : claimToolsTlmAction(a, p, value)),
      kind === 'deposit' ? 'Deposit successful' : 'Withdraw successful',
      () =>
        Promise.all([queryClient.invalidateQueries({ queryKey: toolLoaningKeys.toolWallet(account) }), refreshPlayer(account)]),
      kind
    )
    if (ok) (kind === 'deposit' ? setDeposit : setWithdraw)('')
  }

  return (
    <Modal className="tl-dialog plates" locked={busy} onClose={onClose}>
      <div className="tl-dialog__body">
        <header className="tl-dialog__head">
          <h2 className="tl-dialog__title">Deposited TLM</h2>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="tl-dialog__balances">
          <button className="tl-plate" onClick={() => setWithdraw(state.value.toFixed(4))} title="Withdraw TLM">
            <span className="tl-plate__label">Deposited TLM</span>
            <span className="tl-plate__value">
              <DepositValue wallet={wallet.data} />
            </span>
          </button>
          <div className="tl-plate">
            <span className="tl-plate__label">Available TLM</span>
            <span className="tl-plate__value num is-positive">{player.tlm.toFixed(4)} TLM</span>
          </div>
        </div>

        {(['deposit', 'withdraw'] as const).map((kind) => (
          <form key={kind} className="tl-form" onSubmit={(e) => submit(e, kind)}>
            <label className="tl-field">
              <span className="tl-field__label">{kind === 'deposit' ? 'Deposit TLM' : 'Withdraw TLM'}</span>
              <span className="tl-field__row">
                <input
                  className="input tl-field__input num"
                  inputMode="decimal"
                  placeholder="0.0000"
                  value={kind === 'deposit' ? deposit : withdraw}
                  onChange={(e) => (kind === 'deposit' ? setDeposit : setWithdraw)(e.target.value.replace(',', '.'))}
                />
                <Button
                  type="submit"
                  isLoading={pending === kind}
                  disabled={busy || !(Number(kind === 'deposit' ? deposit : withdraw) > 0)}
                >
                  {kind === 'deposit' ? 'Deposit' : 'Withdraw'}
                </Button>
              </span>
            </label>
          </form>
        ))}

        <div className="loan-callout">
          <a href="https://medium.com/p/3cea7a66ce77" target="_blank" rel="noreferrer" aria-label="Medium">
            <InfoCircleIcon size={20} />
          </a>
          <p>The Trilium you earn from your referrals using Tool Loaning is automatically added to your deposit.</p>
        </div>
      </div>
    </Modal>
  )
}
