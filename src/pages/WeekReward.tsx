import { useMemo, useState } from 'react'

import { claimWeekAction } from '@/chain/actions/rewards'
import { Button } from '@/components/Button'
import { InfoCircleIcon } from '@/icons/ui'
import { PageHeader } from '@/components/PageHeader'
import { refreshPlayer, usePlayer } from '@/data/player'
import { useMissionSettings, useWeeks } from '@/data/game'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'
import { useTransaction } from '@/wallet/useTransaction'
import { publicUrl } from '@/lib/publicUrl'

import './WeekReward.css'

interface Card {
  weekId: number
  claimable: boolean
  userTlm: number
}

export default function WeekReward() {
  const { run, busy, pending, account } = useTransaction()
  const player = usePlayer()
  const { currentWeek, weeks, query: weeksQuery } = useWeeks()
  const settings = useMissionSettings()
  const [claimed, setClaimed] = useState<number[]>([])

  const cards = useMemo<Card[]>(() => {
    const now = Date.now()
    return [3, 2, 1, 0].map((i) => {
      const weekId = (currentWeek?.week_id ?? 0) - (i + 1)
      const weekly = player.weeklies.find((w) => w.week?.week_id === weekId)
      const week = weekly?.week ?? weeks.find((w) => w.week_id === weekId)
      const claimable =
        !!weekly &&
        !!week &&
        weekly.total_quest_points > 0 &&
        now < weekly.expiresAt &&
        now > +chainDate(week.end_date) &&
        !claimed.includes(weekId)
      const userTlm =
        claimable && week!.total_quest_points > 0
          ? (tlmToNumber(week!.initial_prize_pool) * weekly!.total_quest_points) / week!.total_quest_points
          : 0
      return { weekId, claimable, userTlm }
    })
  }, [currentWeek, weeks, player.weeklies, claimed])

  async function claim(weekId: number, withTlm: boolean) {
    const done = await run(
      (wallet, permission) => claimWeekAction(wallet, permission, weekId, withTlm),
      'Claim successfully!',
      () => Promise.all([refreshPlayer(account), weeksQuery.refetch()]),
      `${weekId}-${withTlm}`
    )
    if (done) setClaimed((prev) => [...prev, weekId])
  }

  const cost = settings.data?.cost_nftpoints_claim ?? 0

  return (
    <>
      <PageHeader title="Weekly Rewards" image={publicUrl('/assets/background/bg-week-rewards.webp')} />

      <div className="page week-reward plates">
        <div className="callout">
          <InfoCircleIcon size={20} />
          <p>Rewards are available for a maximum of 4 weeks. Any unclaimed rewards are returned to Mission Control.</p>
        </div>

        <div className="week-cards">
          {cards.map((card, index) => (
            <article
              key={card.weekId}
              className={`week-card ${card.claimable ? 'is-claimable' : ''}`}
              style={{ '--mobile-order': 3 - index } as React.CSSProperties}
            >
              <div className="week-card__head">
                <h2 className="week-card__title">Week {weeksQuery.isLoading ? '…' : card.weekId}</h2>
                {!card.claimable && <span className="week-card__status">Claimed</span>}
              </div>

              {card.claimable ? (
                <>
                  <div className="week-card__amount">
                    <span>Total reward of the week</span>
                    <strong className="num">
                      {card.userTlm.toFixed(4)} <TLMSVG />
                    </strong>
                  </div>
                  <p className="week-card__desc">To claim your reward, you have two options:</p>
                  <div className="week-card__actions">
                    <span className="week-card__label">CLAIM USING</span>
                    <Button
                      color="gradientPink"
                      block
                      isLoading={pending === `${card.weekId}-false`}
                      disabled={busy || player.mcPoints < cost}
                      title={player.mcPoints < cost ? `${cost.toLocaleString('en-US')} MC Points` : undefined}
                      onClick={() => claim(card.weekId, false)}
                    >
                      <span className="num">{cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>{' '}
                      <StarSVG color="#fff" />
                    </Button>
                    <Button
                      block
                      isLoading={pending === `${card.weekId}-true`}
                      disabled={busy}
                      onClick={() => claim(card.weekId, true)}
                    >
                      <span className="num">{(card.userTlm / 2).toFixed(4)}</span> <TLMSVG />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="week-card__desc">
                    These rewards were either already claimed by you, or you did not participate in this week.
                  </p>
                </>
              )}
            </article>
          ))}
        </div>
      </div>
    </>
  )
}
