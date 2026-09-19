import { useId, useMemo, useState } from 'react'

import { usePlayer } from '@/data/player'
import { useWeeks } from '@/data/game'
import QuestSVG from '@/icons/quest'
import TLMSVG from '@/icons/tlm'
import { ChevronIcon } from '@/icons/ui'
import { formatAmount } from '@/lib/format'
import { chainDate, durationLabel, useNow } from '@/lib/time'

/** Whether the player opened the weekly statistics, kept in their browser. */
const OPEN_KEY = 'weekly-statistics-open'

function savedOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function WeeklyStatistics() {
  const player = usePlayer()
  const { weeks, currentWeek, prizePool } = useWeeks()
  const now = useNow(60_000)
  const [open, setOpen] = useState(savedOpen)
  const bodyId = useId()

  function toggle() {
    setOpen((was) => {
      try {
        localStorage.setItem(OPEN_KEY, was ? '0' : '1')
      } catch {
        // Without storage it opens closed again next visit.
      }
      return !was
    })
  }

  const lastWeek = useMemo(() => {
    const pastDate = now - 7 * 24 * 60 * 60 * 1000
    return weeks.find((w) => pastDate > +chainDate(w.start_date) && pastDate < +chainDate(w.end_date))
  }, [weeks, now])

  const totalPoints = currentWeek?.total_quest_points ?? 0
  const tlmPer100 = totalPoints > 0 ? prizePool / (totalPoints / 100) : 0

  return (
    <section className={`panel weekly ${open ? 'is-open' : ''}`}>
      {/* Collapsed by default: the prize pool at a glance, the rest a click away. */}
      <button type="button" className="panel__head weekly__toggle" onClick={toggle} aria-expanded={open} aria-controls={bodyId}>
        <h2 className="panel__title">WEEKLY STATISTICS</h2>
        <span className="weekly__glance">
          {!open && (
            <strong className="num">
              {formatAmount(prizePool)} <TLMSVG />
            </strong>
          )}
          <ChevronIcon className="weekly__chevron" />
        </span>
      </button>

      <div className="weekly__body" id={bodyId} hidden={!open}>
        <div className="weekly__prize">
          <span>Prize Pool</span>
          <strong className="num">
            {formatAmount(prizePool)} <TLMSVG />
          </strong>
        </div>

        <dl className="stat-list">
          <div>
            <dt>
              Total <QuestSVG />
            </dt>
            <dd className="num">{totalPoints.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>
              Your <QuestSVG />
            </dt>
            <dd className="num">{player.rewardPoints.toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>
              Last Week Total <QuestSVG />
            </dt>
            <dd className="num">{(lastWeek?.total_quest_points ?? 0).toLocaleString('en-US')}</dd>
          </div>
          <div>
            <dt>
              Current TLM per 100 <QuestSVG />
            </dt>
            <dd className="num">
              {tlmPer100.toLocaleString('en-US', { maximumFractionDigits: 2 })} <TLMSVG />
            </dd>
          </div>
          <div>
            <dt>Week ends in</dt>
            <dd className="num">{currentWeek ? durationLabel(chainDate(currentWeek.end_date), now) : '–'}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
