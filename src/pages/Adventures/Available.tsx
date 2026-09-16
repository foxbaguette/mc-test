import { Link } from 'react-router-dom'

import { useModUnlocks } from '@/data/adventures'
import type { Adventure } from '@/data/types/adventures'
import QuestSVG from '@/icons/quest'
import StarSVG from '@/icons/star'
import { chainDate, countdown, timeLeft } from '@/lib/time'

import { AdventureImg, ModGrid, Stat, SponsorRibbon } from './shared'

export function AvailableList({ items, now, nextAt }: { items: Adventure[]; now: number; nextAt: number }) {
  const unlocks = useModUnlocks()

  // A new adventure is created automatically; show how long that still takes.
  const countdownBar = nextAt > now && <p className="adv-next num">Next adventure in {countdown(timeLeft(nextAt, now))}</p>

  if (items.length === 0)
    return (
      <div className="adv-list">
        {countdownBar}
        <div className="panel adv-empty">No adventure available</div>
      </div>
    )

  return (
    <div className="adv-list">
      {countdownBar}
      {items.map((adventure) => {
        const to = String(adventure.adventureid)
        return (
          <article key={adventure.adventureid} className="panel adv-card">
            <div className="adv-card__main">
              <p className="adv-status num">expires in {countdown(timeLeft(+chainDate(adventure.enter_end), now))}</p>
              <h2 className="adv-card__title">
                <Link to={to}>{adventure.title}</Link>
              </h2>
              <div className="adv-card__data">
                <Stat label="Duration" value={`${adventure.duration_hours / 24} Days`} />
                <Stat label="Total Rewards" value={adventure.reward_qp} icon={<QuestSVG />} />
                <Stat label="MC Point Cost" value={adventure.point_cost.toLocaleString('en-US')} icon={<StarSVG />} />
                <Link to={to} className="adv-card__view">
                  View
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
              <ModGrid mods={adventure.mods} unlocks={unlocks} />
            </div>

            <div className="adv-card__side">
              <Link to={to} className="adv-media" tabIndex={-1} aria-hidden>
                <SponsorRibbon adventure={adventure} />
                <AdventureImg image={adventure.image} />
              </Link>
            </div>
          </article>
        )
      })}
    </div>
  )
}
