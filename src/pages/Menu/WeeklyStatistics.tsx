import { useMemo } from 'react'

import { usePlayer } from '@/data/player'
import { useWeeks } from '@/data/game'
import QuestSVG from '@/icons/quest'
import TLMSVG from '@/icons/tlm'
import { formatAmount } from '@/lib/format'
import { chainDate, durationLabel, useNow } from '@/lib/time'

export function WeeklyStatistics() {
  const player = usePlayer()
  const { weeks, currentWeek, prizePool } = useWeeks()
  const now = useNow(60_000)

  const lastWeek = useMemo(() => {
    const pastDate = now - 7 * 24 * 60 * 60 * 1000
    return weeks.find((w) => pastDate > +chainDate(w.start_date) && pastDate < +chainDate(w.end_date))
  }, [weeks, now])

  const totalPoints = currentWeek?.total_quest_points ?? 0
  const tlmPer100 = totalPoints > 0 ? prizePool / (totalPoints / 100) : 0

  return (
    <section className="panel weekly">
      <div className="panel__head">
        <h2 className="panel__title">WEEKLY STATISTICS</h2>
      </div>

      <div className="weekly__body">
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
