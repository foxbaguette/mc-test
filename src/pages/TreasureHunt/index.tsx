import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Button } from '@/components/Button'
import { MiningBlocked } from '@/components/MiningBlocked'
import { RefreshIcon } from '@/icons/ui'
import { Ticking } from '@/components/Ticking'
import { PageHeader } from '@/components/PageHeader'
import { refreshMining, useEquippedTools, useMiner } from '@/data/mining'
import { refreshTreasureHunts, type TreasureHunt, useFinishedHunts, useTreasureHunts } from '@/data/treasureHunts'
import { useMembership } from '@/data/player'
import FinishFlagSVG from '@/icons/finish-flag'
import ShardsSVG from '@/icons/shards'
import TLMSVG from '@/icons/tlm'
import TreasureSVG from '@/icons/treasure'
import { landImage, tlmToNumber } from '@/lib/format'
import { chainDate, cooldownLabel, formatDate, shortDuration, useClockFor } from '@/lib/time'
import { mineReadyAt } from '@/mining/estimates'
import { mineNow } from '@/mining/mineNow'
import { useCanMine, useSession } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './TreasureHunt.css'

type View = 'active' | 'finished'

const VIEWS: { value: View; label: string }[] = [
  { value: 'active', label: 'Live & Upcoming' },
  { value: 'finished', label: 'Finished' }
]

export default function TreasureHuntPage() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const player = useMembership()
  const hunts = useTreasureHunts()
  const finished = useFinishedHunts()
  const miner = useMiner(account)
  const tools = useEquippedTools(account)
  const [busy, setBusy] = useState<string | null>(null)
  const canMine = useCanMine()
  const [view, setView] = useState<View>('active')
  // Phones show the first lines of the intro; a tap opens the rest.
  const [introOpen, setIntroOpen] = useState(false)

  const refreshing = hunts.isFetching || miner.isFetching || tools.isFetching
  const list = hunts.data ?? []
  const startOf = (hunt: TreasureHunt) => +chainDate(hunt.start_date)
  const readyOf = (hunt: TreasureHunt) => mineReadyAt(hunt.land.delay, tools.data, miner.data?.last_mine)
  // Re-render when a hunt opens or a cooldown ends; the countdowns tick on their own.
  const now = useClockFor([...list.map(startOf), ...list.map(readyOf)])
  const live = list.filter((hunt) => startOf(hunt) <= now)
  const upcoming = list.filter((hunt) => startOf(hunt) > now)

  async function handleMine(hunt: TreasureHunt) {
    if (!account) return
    setBusy(hunt.treasure_name)
    await mineNow({ account, permission, tools: tools.data, landId: hunt.land_id })
    setBusy(null)
  }

  const card = (hunt: TreasureHunt) => {
    const start = startOf(hunt)
    const started = start <= now
    const readyAt = readyOf(hunt)
    const ready = readyAt <= now

    return (
      <article key={hunt.treasure_name} className={`hunt ${started ? 'is-live' : ''}`}>
        <div className="hunt__media">
          <img src={landImage(hunt.landName)} alt={hunt.landName} loading="lazy" />
          <span className={`hunt__state num ${started ? 'is-live' : ''}`}>
            {started ? 'LIVE' : <Ticking render={(tick) => `starts in ${shortDuration(start - tick)}`} />}
          </span>
        </div>

        <div className="hunt__body">
          <h3 className="hunt__title">{hunt.landName}</h3>
          <p className="hunt__where num">
            {hunt.planetName} · {hunt.land.x}:{hunt.land.y}
          </p>

          <div className="hunt__plates">
            <span className="hunt__plate hunt__plate--reward">
              <span className="hunt__plate-label">Reward</span>
              <span className="hunt__plate-value num">
                {tlmToNumber(hunt.reward).toLocaleString('en-US')} <TLMSVG />
              </span>
            </span>
            <span className="hunt__plate">
              <span className="hunt__plate-label">Target</span>
              <span className="hunt__plate-value num">
                {hunt.target.toLocaleString('en-US')} {hunt.target_type === 'tlm' ? <TLMSVG /> : <ShardsSVG />}
              </span>
            </span>
          </div>

          {/* Mining before the hunt opens is worth it: the cooldown decides, not the start. */}
          <Button
            block
            color={started ? 'gradientYellow' : 'solidBlue'}
            isLoading={busy === hunt.treasure_name}
            disabled={!canMine || !!busy || !ready}
            onClick={() => handleMine(hunt)}
          >
            <span className="num">{ready ? 'MINE' : <Ticking render={(tick) => cooldownLabel(readyAt, tick)} />}</span>
          </Button>
        </div>
      </article>
    )
  }

  return (
    <>
      <PageHeader title="Treasure Hunt" image={publicUrl('/assets/background/bg-login.webp')} />

      <div className="page hunts plates">
        <MiningBlocked />

        <section className="panel hunts__intro">
          <h2 className="hunts__intro-title">Treasure Hunt</h2>
          <p className={introOpen ? 'is-open' : ''} onClick={() => setIntroOpen((open) => !open)} aria-expanded={introOpen}>
            A treasure is buried on a chosen land. Mine that land and you join the hunt: every player who mines it before the
            treasure is found shares the reward equally. The hunt ends as soon as the land has produced the target amount, so the
            sooner you mine, the better your odds — mining just before a hunt opens puts your cooldown where you want it. For more
            details about current and upcoming Treasure Hunts, please visit{' '}
            <a target="_blank" href="https://larucheaw.online/live/index.html" rel="noreferrer">
              here
            </a>
            .
          </p>
          <ol className="hunts__steps">
            <li>
              <TreasureSVG /> Pick a hunt below
            </li>
            <li>
              <FinishFlagSVG /> Mine its land, from just before it opens
            </li>
            <li>
              <TLMSVG /> Share the reward with everyone who helped
            </li>
          </ol>
        </section>

        <div className="hunts__bar">
          <div className="segmented" role="tablist" aria-label="Treasure hunts">
            {VIEWS.map((item) => (
              <button
                key={item.value}
                role="tab"
                aria-selected={view === item.value}
                className={view === item.value ? 'is-active' : ''}
                onClick={() => setView(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="hunts__bar-end">
            {view === 'active' && (
              <span className="hunts__count num">
                {hunts.isLoading ? 'Loading' : `${live.length} live · ${upcoming.length} upcoming`}
              </span>
            )}
            <button
              className={`icon-btn ${refreshing ? 'is-spinning' : ''}`}
              disabled={!player.isFullMember || refreshing}
              onClick={() => Promise.all([refreshMining(account), refreshTreasureHunts()])}
              aria-label="Refresh"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        {view === 'finished' ? null : hunts.isLoading ? (
          <div className="hunts__grid">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton hunt--skeleton" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="panel empty">No treasure hunt announced. Check back later!</p>
        ) : (
          <div className="hunts__grid">{[...live, ...upcoming].map(card)}</div>
        )}

        {view === 'finished' && (
          <section className="hunts__past">
            {finished.isLoading ? (
              <div className="skeleton hunts__past-skeleton" />
            ) : (finished.data ?? []).length === 0 ? (
              <p className="panel empty">No finished treasure hunts</p>
            ) : (
              <ul className="past">
                {(finished.data ?? []).map((hunt) => {
                  const won = !!account && hunt.winners.includes(account)
                  const share = hunt.winners.length > 0 ? tlmToNumber(hunt.reward) / hunt.winners.length : 0
                  return (
                    <li key={hunt.treasure_name} className={`past__row ${won ? 'is-won' : ''}`}>
                      <span className="past__land">
                        <img src={landImage(hunt.landName)} alt="" loading="lazy" />
                        <span>
                          <strong>{hunt.landName || hunt.treasure_name}</strong>
                          <small className="num">{formatDate(chainDate(hunt.start_date))}</small>
                        </span>
                      </span>

                      <span className="past__reward num">
                        {tlmToNumber(hunt.reward).toLocaleString('en-US')} <TLMSVG />
                      </span>

                      <span className="past__winners">
                        <span className="past__winners-count num">{hunt.winners.length} hunters</span>
                        {share > 0 && <span className="past__share num">{share.toFixed(4)} TLM each</span>}
                      </span>

                      {won && <span className="past__you">You</span>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  )
}
