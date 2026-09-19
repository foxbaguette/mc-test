import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import type { AnyAction } from '@wharfkit/session'

import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { RefreshIcon } from '@/icons/ui'
import { PageHeader } from '@/components/PageHeader'
import { Select } from '@/components/Select'
import { refreshApplications, useFlagReasons, usePendingApplications, useSupportLog } from '@/data/applications'
import { usePlayerSupport } from '@/data/player'
import type { Member } from '@/data/types/player'
import { chainDate, formatDateTimeShort } from '@/lib/time'
import { approveMemberAction, delayMemberAction, flagMemberAction } from '@/chain/actions/members'
import { useTransaction } from '@/wallet/useTransaction'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './Applications.css'

const DELAYS = [10, 30, 90, 180]
const CUSTOM = 'custom'

export default function Applications() {
  const account = useAccount()
  const support = usePlayerSupport(account)
  const { pending, isLoading, isFetching } = usePendingApplications()

  // Support team only; wait for the lookup so a supporter is never bounced out.
  if (!support.isLoading && !support.data?.wallet) return <Navigate to="/menu" replace />

  return (
    <>
      <PageHeader title="Applications" image={publicUrl('/assets/background/bg-applications.webp')} />

      <div className="page apps">
        <div className="apps__bar">
          <span className="chip num">{isLoading ? '…' : pending.length}</span>
          <button
            className={`icon-btn ${isFetching ? 'is-spinning' : ''}`}
            onClick={refreshApplications}
            disabled={isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        {isLoading ? (
          <div className="apps__list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton apps__skeleton" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <p className="panel empty">No applications</p>
        ) : (
          <div className="apps__list">
            {pending.map((member) => (
              <ApplicationCard key={member.wallet} member={member} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ApplicationCard({ member }: { member: Member }) {
  const reasons = useFlagReasons()
  const log = useSupportLog(member.wallet)
  const { run, busy } = useTransaction()
  const [reason, setReason] = useState(CUSTOM)
  const [text, setText] = useState('')

  const options = useMemo(
    () => [
      { value: CUSTOM, label: 'Custom' },
      ...(reasons.data ?? []).map((row, i) => ({ value: String(i), label: row.title || row.flag_reason }))
    ],
    [reasons.data]
  )

  function pickReason(value: string) {
    setReason(value)
    setText(value === CUSTOM ? '' : ((reasons.data ?? [])[Number(value)]?.flag_reason ?? ''))
  }

  const act = (build: (account: string, permission: string) => AnyAction, message: string) =>
    run(build, message, refreshApplications)
  const lastAction = log.data?.[0]

  return (
    <article className="panel apl">
      <header className="apl__head">
        <Avatar avatar={member.avatar} rarity={member.avatarrarity} size={38} />
        <div className="apl__who">
          <h2 className="apl__tag">{member.playertag || member.wallet}</h2>
          <span className="apl__wallet num">{member.wallet}</span>
        </div>
        <span className="chip num">#{member.member_id}</span>
        <a
          className="apl__link"
          href={`https://atomichub.io/profile/wax-mainnet/${member.wallet}`}
          target="_blank"
          rel="noreferrer"
          aria-label="AtomicHub"
        >
          <img src={publicUrl('/assets/icons/atomic.png')} alt="" />
        </a>
        <a
          className="apl__link"
          href={`https://waxblock.io/account/${member.wallet}`}
          target="_blank"
          rel="noreferrer"
          aria-label="WAXBlock"
        >
          <img src={publicUrl('/assets/icons/cube.png')} alt="" />
        </a>
      </header>

      <dl className="apl__facts">
        <div>
          <dt>Level</dt>
          <dd className="num">{member.level}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd className="num">{member.joined ? formatDateTimeShort(chainDate(member.joined)) : '-'}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd className="num">{formatDateTimeShort(chainDate(member.next_review))}</dd>
        </div>
      </dl>

      {lastAction && (
        <p className="apl__log">
          <span className="num">{formatDateTimeShort(chainDate(lastAction.timestamp))}</span> {lastAction.action}
        </p>
      )}

      <div className="apl__reason">
        <Select
          value={reason}
          options={options}
          onChange={pickReason}
          borderColors={['#FFB31F', '#FFB800']}
          ariaLabel="Flag reason"
        />
        <textarea
          className="input apl__text"
          rows={2}
          value={text}
          disabled={reason !== CUSTOM}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="apl__actions">
        <Button
          size="sm"
          color="gradientGreen"
          disabled={busy}
          onClick={() => act((a, p) => approveMemberAction(a, p, member.wallet), 'Approved')}
        >
          Approve
        </Button>
        <Button
          size="sm"
          color="danger"
          disabled={busy || !text.trim()}
          onClick={() => act((a, p) => flagMemberAction(a, p, member.wallet, text.trim()), 'Flagged')}
        >
          Flag
        </Button>
      </div>

      <div className="apl__delays">
        {DELAYS.map((days) => (
          <Button
            key={days}
            size="sm"
            color="ghost"
            disabled={busy}
            onClick={() => act((a, p) => delayMemberAction(a, p, member.wallet, days), 'Delayed')}
          >
            Delay {days}
          </Button>
        ))}
      </div>
    </article>
  )
}
