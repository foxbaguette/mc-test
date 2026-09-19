import { useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react'

import { Button } from '@/components/Button'
import { PageHeader } from '@/components/PageHeader'
import { refreshPlayer, useDailySpinsToday, useMembership, usePlayer } from '@/data/player'
import { useClaimChances } from '@/data/game'
import { readMember } from '@/data/tables'
import { sleep } from '@/lib/format'
import { chainDate, cooldownLabel, timeAgo, useClockFor, useNow } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { dailyRewardActions } from '@/chain/actions/members'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'

import { WheelLights, WinSparks } from './Lights'
import { Wheel, WheelRim, type WheelSegment } from './Wheel'
import StarSVG from '@/icons/star'

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

interface Prize {
  mcp: number
  color: string
  /** Chance of landing on this prize, 0 to 1. */
  chance: number
}

/** The wheel's prizes with their odds: slices of the same prize add up, largest prize first. */
function prizesOf(chances: { mcp: number; color: string; chance_weight: number }[]): Prize[] {
  const total = chances.reduce((sum, c) => sum + c.chance_weight, 0) || 1
  const byMcp = new Map<number, Prize>()
  for (const c of chances) {
    const prize = byMcp.get(c.mcp) ?? { mcp: c.mcp, color: `rgb(${c.color})`, chance: 0 }
    prize.chance += c.chance_weight / total
    byMcp.set(c.mcp, prize)
  }
  return [...byMcp.values()].sort((a, b) => b.mcp - a.mcp)
}

const formatChance = (chance: number) => {
  const pct = chance * 100
  return `${pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2)}%`
}

/** Wide enough for the panels beside the wheel (see DailyRewards.css). */
const WIDE = '(min-width: 1100px)'

function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(WIDE).matches
  )
}

/** Today's spins across Mission Control: how many, what they won, and the big wins by name. */
function LuckySpins() {
  const today = useDailySpinsToday()
  const now = useNow(60_000)
  if (!today.data) return null
  return (
    <section className="daily__lucky" aria-label="Today's lucky spins">
      <h2 className="daily__side-title">Today's lucky spins</h2>
      <p className="daily__lucky-sum num">
        {today.data.count.toLocaleString('en-US')} spins · {today.data.total.toLocaleString('en-US')} <StarSVG />
      </p>
      {today.data.big.length > 0 && (
        <ul>
          {today.data.big.slice(0, 10).map((spin) => (
            <li key={spin.wallet}>
              <span className="daily__lucky-name" title={spin.wallet}>
                {spin.name}
              </span>
              <span className="daily__lucky-reward num">
                {spin.reward.toLocaleString('en-US')} <StarSVG />
              </span>
              <span className="daily__lucky-when num">{timeAgo(spin.at, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
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

  const prizes = useMemo(() => prizesOf(chances.data ?? []), [chances.data])
  const mcPoints = usePlayer().mcPoints
  const wide = useWide()
  const winColor = segments[target]?.color
  // Each landing plays the sparks afresh.
  const [burst, setBurst] = useState(0)

  const showClaimed = (onCooldown && !spinning) || revealed
  // Straight after a spin the prize is a result, not a rejection.
  const claimedLabel = revealed ? 'Claimed' : 'Daily already claimed'

  return (
    <>
      <PageHeader title="Daily Rewards" image={publicUrl('/assets/background/bg-daily-rewards.webp')} />

      <div className="page daily">
        <div className="daily__side daily__side--left">
          {/* Where the player stands: the last prize, the next spin and their MC Points. */}
          <aside className="daily__status-card" aria-label="Your daily claim">
            <div>
              <span className="daily__side-title">Last prize</span>
              <strong className="num">
                {lastReward ? (
                  <>
                    {lastReward.toLocaleString('en-US')} <StarSVG />
                  </>
                ) : (
                  '–'
                )}
              </strong>
            </div>
            <div>
              <span className="daily__side-title">Next spin</span>
              <strong className="num">
                {onCooldown ? <Ticking render={(tick) => cooldownLabel(readyAt, tick, 'Now')} /> : 'Now'}
              </strong>
            </div>
            <div>
              <span className="daily__side-title">Your MC Points</span>
              <strong className="num">
                {mcPoints.toLocaleString('en-US')} <StarSVG />
              </strong>
            </div>
          </aside>
          {/* The prizes and their odds, as the chain sets them. */}
          <aside className="daily__prizes" aria-label="Prizes">
            <h2 className="daily__side-title">Prizes</h2>
            <ul>
              {prizes.map((prize) => (
                <li key={prize.mcp} style={{ '--prize': prize.color } as CSSProperties}>
                  <span className="daily__prize-amount num">
                    {prize.mcp.toLocaleString('en-US')} <StarSVG />
                  </span>
                  <span className="daily__prize-chance num">{formatChance(prize.chance)}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>

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
                  setBurst((n) => n + 1)
                }}
              />
            ) : (
              <div className="skeleton daily__wheel-loading" />
            )}
            <WheelRim />
            <WheelLights mode={spinning ? 'spinning' : revealed ? 'won' : 'idle'} color={winColor} />
            {revealed && winColor && burst > 0 && <WinSparks color={winColor} burst={burst} />}
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

        <div className="daily__side daily__side--right">
          {/* The whole member table, so only where it shows. */}
          {wide && <LuckySpins />}
        </div>
      </div>
    </>
  )
}
