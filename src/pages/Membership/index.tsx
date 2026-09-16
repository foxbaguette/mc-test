import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { DISCORD_URL } from '@/chain/config'
import { Button } from '@/components/Button'
import { CheckSquareIcon } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { toast } from '@/components/toast'
import { refreshPlayer, useMembership } from '@/data/player'
import { useMcSettings } from '@/data/game'
import DiscordSVG from '@/icons/discord'
import MediumSVG from '@/icons/medium'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { chainDate, formatDate } from '@/lib/time'
import { signUpAction } from '@/mining/actions'
import { useSession } from '@/state/session'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'
import { publicUrl } from '@/lib/publicUrl'

import './Membership.css'

const WELCOME_URL = 'https://medium.com/mining-matters/welcome-to-mission-control-50369cdf7ebe'

/** What each tier unlocks, in the order the original listed them. */
const FEATURES = [
  'Tool Tactician',
  'On-Site Mining',
  'Mine Maximizer',
  'MCP for shard mining',
  'Adventures',
  'Weekly Quests',
  'TLM Prize Pool',
  'Voting',
  'Outpost Builder',
  'Tool Loaning'
]
const FREE_TIER = ['Tool Tactician']
const MEMBER_TIER = ['Tool Tactician', 'On-Site Mining', 'Mine Maximizer', 'MCP for shard mining', 'Tool Loaning']

export default function Membership() {
  const player = useMembership()
  const settings = useMcSettings()
  const [searchParams] = useSearchParams()
  const [joining, setJoining] = useState(searchParams.has('ref') && !player.isMember)

  const cost = settings.data?.signup_cost ?? ''
  const currentTier = !player.isMember || player.flagged ? 'free' : player.isTrial ? 'member' : 'verified'

  if (joining) return <JoinForm cost={cost} onDone={() => setJoining(false)} />

  const intro = !player.isMember
    ? 'Become a member and start earning mc points today'
    : player.flagged
      ? 'YOUR MEMBERSHIP HAS BEEN REVOKED'
      : 'YOU ARE AN ACTIVE MEMBER OF MISSION CONTROL.'

  return (
    <>
      <PageHeader title="Membership" image={publicUrl('/assets/background/bg-member.jpeg')} />

      <div className="page member">
        <h2 className="member__intro">{intro}</h2>

        {player.isMember && !player.flagged && <ReferralPanel account={player.account} />}

        {(!player.isMember || player.isTrial || player.flagged) && (
          <section className={`member__status ${player.flagged ? 'is-revoked' : ''}`}>
            <h3 className="member__status-title">Mission Control</h3>
            <p>
              {!player.isMember ? (
                'Mission Control does not allow using multiple accounts, software for automation or any other methods that would give a player unfair advantages. Doing so can lead to have membership revoked.'
              ) : player.flagged ? (
                'Your membership has been revoked for a violation of the rules. Rules include not using multiple accounts, software for automation or any other methods that would give a player unfair advantages.'
              ) : (
                <>
                  The next full membership check will start on{' '}
                  <span className="num">{player.member ? formatDate(chainDate(player.member.next_review)) : ''}</span>.
                </>
              )}
            </p>
          </section>
        )}

        <div className="member__tiers">
          <Tier
            title="FREE"
            active={FREE_TIER}
            current={currentTier === 'free'}
            status={<Badge state="active">ACTIVE</Badge>}
            description="Available to all visitors of our website. No account required."
          />

          <Tier
            title="MEMBER"
            active={MEMBER_TIER}
            current={currentTier === 'member'}
            status={
              player.isMember ? (
                <Badge state={player.flagged ? 'revoked' : 'active'}>{player.flagged ? 'REVOKED' : 'ACTIVE'}</Badge>
              ) : (
                <Button size="sm" onClick={() => setJoining(true)}>
                  BECOME MEMBER
                </Button>
              )
            }
            description={`Become a member for just ${tlmToNumber(cost).toLocaleString('en-US')} TLM`}
          />

          <Tier
            title="VERIFIED MEMBER"
            active={FEATURES}
            current={currentTier === 'verified'}
            status={
              !player.isMember || player.flagged ? (
                <Badge state="inactive">INACTIVE</Badge>
              ) : player.isTrial ? (
                <Badge state="pending">PENDING</Badge>
              ) : (
                <Badge state="active">ACTIVE</Badge>
              )
            }
            description="Member accounts regularly get checked if they are eligible for verified membership. No further action required."
          />
        </div>
      </div>
    </>
  )
}

interface TierProps {
  title: string
  active: string[]
  status: React.ReactNode
  description: string
  /** The tier the player is on right now. */
  current?: boolean
}

function Tier({ title, active, status, description, current }: TierProps) {
  return (
    <section className={`member__tier ${current ? 'is-current' : ''}`}>
      <h2 className="member__tier-title">{title}</h2>
      <div className="member__tier-status">{status}</div>
      <ul className="member__features">
        {FEATURES.map((feature) => {
          const included = active.includes(feature)
          return (
            <li key={feature} className={included ? 'is-on' : 'is-off'}>
              {included ? <CheckSquareIcon size={20} color="#00D1FF" /> : <CrossIcon />}
              <span>{feature}</span>
            </li>
          )
        })}
      </ul>
      <p className="member__tier-desc">{description}</p>
    </section>
  )
}

/** A status pill with a dot in the state's colour. */
function Badge({ state, children }: { state: 'active' | 'pending' | 'inactive' | 'revoked'; children: React.ReactNode }) {
  return <span className={`member__badge is-${state}`}>{children}</span>
}

function CrossIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D32C54"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function ReferralPanel({ account }: { account: string | null }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL}membership?ref=${account}`)
      toast.success('Ref link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <section className="member__referral">
      <p>
        Invite your friends to join Mission Control and start earning MC Points and TLM <TLMSVG />.
      </p>
      <Button onClick={copy}>Copy referral link</Button>
    </section>
  )
}

function JoinForm({ cost, onDone }: { cost: string; onDone: () => void }) {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const [searchParams] = useSearchParams()
  const [referrer, setReferrer] = useState(searchParams.get('ref') ?? '')
  const [busy, setBusy] = useState(false)

  async function join() {
    if (!account || !cost) return
    setBusy(true)
    try {
      await transact([signUpAction(account, permission, cost, referrer.trim() || undefined)])
      toast.success('Sign up request sent successfully')
      await refreshPlayer(account)
      onDone()
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Membership" image={publicUrl('/assets/background/bg-member.jpeg')} />

      <div className="page member">
        <h2 className="member__intro">JOIN MISSION CONTROL</h2>
        <p className="member__lead">By becoming a member you will instantly unlock:</p>

        <div className="member__unlocks">
          {[
            { title: 'tool loaning', image: 'tool_loaning' },
            { title: 'Mining features', image: 'mining_features' },
            { title: 'Gain MC Points', image: 'gain_mc_points' }
          ].map((card) => (
            <figure key={card.image} className="member__unlock">
              <img src={publicUrl(`/assets/membership/${card.image}.jpeg`)} alt="" loading="lazy" />
              <figcaption>{card.title}</figcaption>
            </figure>
          ))}
        </div>

        <section className="member__join">
          <h2 className="member__intro">RECRUIT A FRIEND</h2>
          <p className="member__lead">
            If you were referred by another player, please enter that player&apos;s WAX wallet in the field below. As a thank you,
            this player will earn bonus MC Points <StarSVG /> every time you spend them and receive TLM <TLMSVG /> each time you
            mine using Tool Loaning. This bonus begins once you become a verified member and lasts for 180 days. Rest assured,
            this comes at no additional cost to you.
          </p>

          <label className="member__field">
            <input
              className="member__input num"
              value={referrer}
              placeholder="wallet"
              onChange={(e) => setReferrer(e.target.value)}
              aria-label="Referring wallet"
            />
            <span className="member__hint">The selection cannot be changed after the application</span>
          </label>

          <p className="member__terms">
            Membership in Mission Control does not guarantee automatic verification. Accounts must fully comply with Alien
            Worlds&apos; Terms of Service, and verification is only granted once the account is confirmed as the sole one in
            Mission Control. Our team conducts regular checks to ensure ongoing compliance.
            <br />
            <br />
            If suspicious activity or potential breaches of the ToS are detected, access to key features will be restricted, and
            membership may be suspended. Please note that the TLM fee covers the cost of the verification process and is
            non-refundable, even if the account is not verified or is later suspended, to prevent system abuse.
          </p>

          <div className="member__join-actions">
            <Button color="ghost" disabled={busy} onClick={onDone}>
              Back
            </Button>
            <Button size="lg" isLoading={busy} disabled={busy || !cost} onClick={join}>
              <span className="num">JOIN NOW ({tlmToNumber(cost).toLocaleString('en-US')} TLM)</span>
            </Button>
          </div>
        </section>

        <footer className="member__footer">
          <p>Get to know us on</p>
          <div className="member__social">
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" aria-label="Discord">
              <DiscordSVG color="white" />
            </a>
            <a href={WELCOME_URL} target="_blank" rel="noreferrer" aria-label="Medium">
              <MediumSVG />
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}
