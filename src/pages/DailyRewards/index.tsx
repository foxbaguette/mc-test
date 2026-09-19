import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'
import { refreshPlayer, useMembership } from '@/data/player'
import { useClaimChances } from '@/data/game'
import { readMember } from '@/data/tables'
import { sleep } from '@/lib/format'
import { chainDate, cooldownLabel, useClockFor } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { dailyRewardActions } from '@/chain/actions/members'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'

import { Wheel, WheelRim, type WheelSegment } from './Wheel'

import './DailyRewards.css'

const DAY = 86_400_000

/**
 * The member row once it shows this claim, so the wheel lands on the prize just won. A node shows
 * it about a second after signing; asked a few times over up to 8 s before settling for what is there.
 */
async function readClaimedMember(account: string, previousClaim: string | undefined) {
  for (const delay of [1000, 1000, 1500, 2000, 2500]) {
    await sleep(delay)
    const member = await readMember(account).catch(() => null)
    if (member && member.last_bgaction !== previousClaim) return member
  }
  return readMember(account).catch(() => null)
}

export default function DailyRewards() {
  const { run, busy: signing, account } = useTransaction()
  const player = useMembership()
  const chances = useClaimChances()
  const [reading, setReading] = useState(false)
  const busy = signing || reading
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
  // Re-render when the next claim opens; the countdown on the button ticks on its own.
  const onCooldown = readyAt > useClockFor([readyAt])
  const lastReward = player.member?.stats?.find((s) => s.key === 'LastDailyReward')?.value

  async function handleSpin() {
    setRevealed(false)
    const previousClaim = player.member?.last_bgaction
    const signed = await run(
      dailyRewardActions,
      // The wheel shows the result; no toast.
      ''
    )
    if (!signed || !account) return

    setReading(true)
    const member = await readClaimedMember(account, previousClaim)
    setReading(false)
    const prize = member?.stats?.find((s) => s.key === 'LastDailyReward')?.value ?? 0
    const matches = segments.map((s, i) => [s, i] as const).filter(([s]) => Number(s.label.replace(/,/g, '')) === prize)
    setTarget(matches.length ? matches[Math.floor(Math.random() * matches.length)][1] : 0)
    setSpinning(true)
    void refreshPlayer(account)
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
            className="daily__spin btn--plate"
            isLoading={busy}
            disabled={busy || spinning || onCooldown || player.isLoading}
            onClick={handleSpin}
          >
            <span className="num">
              {onCooldown ? <Ticking render={(tick) => cooldownLabel(readyAt, tick, 'SPIN')} /> : 'SPIN'}
            </span>
          </Button>
        </section>
      </div>
    </>
  )
}
