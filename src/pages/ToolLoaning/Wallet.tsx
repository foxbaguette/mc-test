import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { InfoCircleIcon } from '@/components/icons'
import { refreshPlayer, usePlayer } from '@/data/player'
import { depositState, useMinerClaim, useToolWallet } from '@/data/toolLoaning'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { chainDate, timeLeft, useNow } from '@/lib/time'
import { claimMinesAction, claimToolsTlmAction, depositToolsTlmAction } from '@/mining/actions'
import { useChainAction } from '@/pages/AwMining/useMemberAction'
import { toolLoaningKeys } from '@/data/keys'

import { DepositValue } from './Shared'

/** Everything about the player's TLM, above whatever tab is open: it applies to all of them. */
export function Wallet() {
  const { run, busy, account } = useChainAction()
  const wallet = useToolWallet(account)
  const claim = useMinerClaim(account)
  const now = useNow(1000)
  const [open, setOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)

  const amount = tlmToNumber(claim.data?.amount)
  const readyAt = claim.data ? +chainDate(claim.data.timestamp) : 0
  const wait = timeLeft(readyAt, now)
  const waitLabel = `${wait.days ? `${wait.days}d` : ''}${wait.hours ? `${wait.hours}h` : ''}${wait.minutes ? `${wait.minutes}m` : ''}${wait.seconds}s`

  async function claimMines() {
    setClaiming(true)
    await run(claimMinesAction, 'TLM Claimed', () => Promise.all([claim.refetch(), refreshPlayer(account)]))
    setClaiming(false)
  }

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
            isLoading={claiming}
            disabled={busy || amount === 0 || wait.ms > 0}
            onClick={claimMines}
          >
            <span className="num">{wait.ms > 0 ? waitLabel : 'Claim'}</span>
          </Button>
        </div>
      </section>

      {open && <DepositDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function DepositDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { run, busy, account } = useChainAction()
  const player = usePlayer()
  const wallet = useToolWallet(account)
  const [deposit, setDeposit] = useState('')
  const [withdraw, setWithdraw] = useState('')
  const [pending, setPending] = useState<'deposit' | 'withdraw' | null>(null)

  const state = depositState(wallet.data)

  async function submit(event: FormEvent, kind: 'deposit' | 'withdraw') {
    event.preventDefault()
    const value = Number(kind === 'deposit' ? deposit : withdraw)
    if (!(value > 0)) return
    setPending(kind)
    const ok = await run(
      (a, p) => (kind === 'deposit' ? depositToolsTlmAction(a, p, value) : claimToolsTlmAction(a, p, value)),
      kind === 'deposit' ? 'Deposit successful' : 'Withdraw successful',
      () =>
        Promise.all([queryClient.invalidateQueries({ queryKey: toolLoaningKeys.toolWallet(account) }), refreshPlayer(account)])
    )
    if (ok) (kind === 'deposit' ? setDeposit : setWithdraw)('')
    setPending(null)
  }

  return (
    <Modal className="tl-dialog plates" locked={busy} onClose={onClose}>
      <div className="tl-dialog__body">
        <header className="tl-dialog__head">
          <h2 className="tl-dialog__title">Deposited TLM</h2>
          <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
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
                  className="tl-field__input num"
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
