import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'
import { toast } from '@/components/Toaster'
import { CONTRACTS } from '@/chain/config'
import { refreshPlayer, useClaimChances, usePlayer } from '@/data/queries'
import { readMember } from '@/data/tables'
import { sleep } from '@/lib/format'
import { chainDate, cooldownLabel, useNow } from '@/lib/time'
import { payCpu } from '@/mining/actions'
import { useSession } from '@/state/session'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'
import { publicUrl } from '@/lib/publicUrl'

import { Wheel, WheelRim, type WheelSegment } from './Wheel'

import './DailyRewards.css'

const DAY = 86_400_000

export default function DailyRewards() {
  const { account, permission } = useSession()
  const player = usePlayer()
  const chances = useClaimChances()
  const now = useNow(1000)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [target, setTarget] = useState(0)
  const [revealed, setRevealed] = useState(false)

  const segments: WheelSegment[] = useMemo(
    () =>
      (chances.data ?? []).map((c) => ({
        id: c.index,
        label: c.title,
        color: `rgb(${c.color})`,
        weight: c.size_weight,
        fontSize: c.size_weight < 12 ? 14 : 20
      })),
    [chances.data]
  )

  // members.mc allows one claim per UTC day: ready once a new UTC day has started since the last claim.
  const lastClaim = player.member?.last_bgaction ? +chainDate(player.member.last_bgaction) : 0
  const readyAt = lastClaim ? Math.floor(lastClaim / DAY) * DAY + DAY : 0
  const label = cooldownLabel(readyAt, now, 'SPIN')
  const onCooldown = label !== 'SPIN'
  const lastReward = player.member?.stats?.find((s) => s.key === 'LastDailyReward')?.value

  async function handleSpin() {
    if (!account) return
    setBusy(true)
    setRevealed(false)
    try {
      await transact([
        payCpu(account, permission, 3),
        {
          account: CONTRACTS.MEMBERS,
          name: 'dailyrewards',
          authorization: [{ actor: account, permission }],
          data: { wallet: account }
        }
      ])
      await sleep(4000)
      const member = await readMember(account)
      const prize = member?.stats?.find((s) => s.key === 'LastDailyReward')?.value ?? 0
      const matches = segments.map((s, i) => [s, i] as const).filter(([s]) => Number(s.label.replace(/,/g, '')) === prize)
      setTarget(matches.length ? matches[Math.floor(Math.random() * matches.length)][1] : 0)
      setSpinning(true)
      void refreshPlayer(account)
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
    } finally {
      setBusy(false)
    }
  }

  const showClaimed = (onCooldown && !spinning) || revealed
  // Straight after a spin the prize is a result, not a rejection.
  const claimedLabel = revealed ? 'Claimed' : 'Daily already claimed'

  return (
    <>
      <PageHeader title="Daily Rewards" image={publicUrl('/assets/background/bg-daily-rewards.webp')} />

      <div className="page daily">
        <section className="daily__stage">
          <p className={`daily__status ${showClaimed ? 'is-visible' : ''}`} aria-live="polite">
            {showClaimed && (
              <>
                {claimedLabel}
                {lastReward ? (
                  <>
                    {' '}
                    – <strong className="num">{lastReward.toLocaleString('en-US')} MC Points</strong>
                  </>
                ) : null}
              </>
            )}
          </p>

          <div className={`daily__wheel ${spinning ? 'is-spinning' : ''}`}>
            {segments.length > 0 ? (
              <Wheel
                segments={segments}
                target={target}
                spinning={spinning}
                onStop={() => {
                  setSpinning(false)
                  setRevealed(true)
                }}
              />
            ) : (
              <div className="skeleton daily__wheel-loading" />
            )}
            <WheelRim />
            <span className="daily__pointer" aria-hidden />
          </div>

          <p className="daily__text">Earn MC Points by helping Mission Control run smoothly. This is available once per day.</p>

          <Button
            size="lg"
            className="daily__spin"
            isLoading={busy}
            disabled={busy || spinning || onCooldown || player.isLoading}
            onClick={handleSpin}
          >
            <span className="num">{label}</span>
          </Button>
        </section>
      </div>
    </>
  )
}
