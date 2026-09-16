import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { DEFAULT_AVATAR } from '@/chain/config'
import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'
import { Select } from '@/components/Select'
import { toast } from '@/components/toast'
import { refreshVoting, useCandidates, useLastVote, useVotePower, VOTING_PLANET, type Candidate } from '@/data/voting'
import BoltSVG from '@/icons/bolt'
import { castVoteActions } from '@/mining/actions'
import { useSession } from '@/state/session'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'
import { publicUrl } from '@/lib/publicUrl'

import './Voting.css'

const NONE = 'none'

/** Mission Control votes through two accounts that back two candidates each: #1 and #2, and #1 and #3. */
const BACKED_SEATS = 3

export default function Voting() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const { candidates, isLoading, isFetching } = useCandidates()
  const power = useVotePower(account)
  const lastVote = useLastVote(account)
  const [first, setFirst] = useState(NONE)
  const [second, setSecond] = useState(NONE)
  const [busy, setBusy] = useState(false)
  const prefilled = useRef(false)

  const byWallet = useMemo(() => new Map(candidates.map((c) => [c.wallet, c])), [candidates])

  // Start from the player's last vote, keeping only candidates who can still be voted for.
  // Runs once, so a refetch never overrides picks the player has changed.
  useEffect(() => {
    if (prefilled.current || isLoading || !lastVote.isFetched) return
    prefilled.current = true
    const [a = NONE, b = NONE] = lastVote.wallets.filter((wallet) => byWallet.has(wallet))
    setFirst(a)
    setSecond(b)
  }, [isLoading, lastVote.isFetched, lastVote.wallets, byWallet])

  // A pick made before the history arrives wins over the prefill.
  function pick(set: (wallet: string) => void, wallet: string) {
    prefilled.current = true
    set(wallet)
  }
  const options = useMemo(
    () => [{ value: NONE, label: 'None' }, ...candidates.map((c) => ({ value: c.wallet, label: c.name }))],
    [candidates]
  )

  const chosen = [first, second].filter((wallet) => wallet !== NONE)

  async function castVote() {
    if (!account || chosen.length === 0) return
    setBusy(true)
    try {
      await transact(castVoteActions(account, permission, VOTING_PLANET, chosen, Math.floor(power.current)))
      toast.success('Vote successfully registered')
      await refreshVoting(account)
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Eyeke Voting" image={publicUrl('/assets/background/bg-voting.jpeg')} />

      <div className="page vote plates">
        <div className="vote__power">
          <p className="vote__power-value num">
            {power.current.toLocaleString('en-US')} / {power.max.toLocaleString('en-US')} <BoltSVG type={2} />
          </p>
          <span className="vote__meter" aria-hidden>
            <span style={{ width: `${power.max > 0 ? Math.min(100, (power.current / power.max) * 100) : 0}%` }} />
          </span>
        </div>

        <section className="vote__picks">
          <h2 className="vote__picks-title">You have 2 votes</h2>
          <div className="vote__grid">
            <CandidatePick
              label="Vote 1"
              value={first}
              options={options.filter((o) => o.value !== second || o.value === NONE)}
              candidate={byWallet.get(first)}
              isLoading={isLoading}
              onChange={(wallet) => pick(setFirst, wallet)}
            />
            <CandidatePick
              label="Vote 2"
              value={second}
              options={options.filter((o) => o.value !== first || o.value === NONE)}
              candidate={byWallet.get(second)}
              isLoading={isLoading}
              onChange={(wallet) => pick(setSecond, wallet)}
            />
          </div>

          <Button
            block
            size="lg"
            isLoading={busy}
            disabled={busy || power.current <= 0 || chosen.length === 0}
            onClick={castVote}
          >
            Cast Vote
          </Button>
        </section>

        <section className="vote__ranking" aria-busy={isFetching}>
          <div className="vote__row vote__row--head">
            <span>Rank</span>
            <span>Candidate</span>
            <span className="vote__wallet-col">Wallet</span>
            <span>Votes</span>
          </div>

          {isLoading ? (
            Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton vote__skeleton" />)
          ) : candidates.length === 0 ? (
            <p className="empty">No candidates to this planet</p>
          ) : (
            candidates.map((candidate, index) => (
              <div key={candidate.wallet} className={`vote__row ${index < BACKED_SEATS ? 'is-top' : ''}`}>
                <span className="vote__rank">
                  <CandidateImg candidate={candidate} size={38} />
                  <span className="num">{index + 1}</span>
                </span>
                <span className="vote__name">{candidate.name}</span>
                <span className="vote__wallet-col num">{candidate.wallet}</span>
                <span className="vote__votes num">
                  {candidate.votes.toLocaleString('en-US')} <BoltSVG type={2} />
                </span>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  )
}

function CandidateImg({ candidate, size }: { candidate?: Candidate; size: number }) {
  return (
    <img
      className="vote__avatar"
      style={{ width: size, height: size }}
      src={candidate?.image || DEFAULT_AVATAR}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = DEFAULT_AVATAR
      }}
    />
  )
}

interface PickProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  candidate?: Candidate
  isLoading: boolean
  onChange: (value: string) => void
}

function CandidatePick({ label, value, options, candidate, isLoading, onChange }: PickProps) {
  return (
    <div className={`vote__pick ${candidate ? 'is-chosen' : ''}`}>
      <div className="vote__pick-head">
        <div className="vote__pick-field">
          <span className="vote__pick-label">{label}</span>
          <Select value={value} options={options} onChange={onChange} ariaLabel={label} />
        </div>
        <CandidateImg candidate={candidate} size={64} />
      </div>
      {isLoading ? (
        <div className="skeleton vote__desc-skeleton" />
      ) : (
        <p className="vote__desc">
          {options.length <= 1
            ? 'No candidates to this planet'
            : candidate
              ? candidate.description || "This candidate doesn't have description"
              : ''}
        </p>
      )}
    </div>
  )
}
