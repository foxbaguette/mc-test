import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { CONTRACTS } from '@/chain/config'
import { Button } from '@/components/Button'
import { InfoCircleIcon } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { toast } from '@/components/toast'
import { refreshPlayer, usePlayer } from '@/data/player'
import { useMissionSettings, useWeeks } from '@/data/game'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { sleep, tlmToNumber } from '@/lib/format'
import { chainDate } from '@/lib/time'
import { useSession } from '@/state/session'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'
import { publicUrl } from '@/lib/publicUrl'

import './WeekReward.css'

interface Card {
  weekId: number
  claimable: boolean
  userTlm: number
}

export default function WeekReward() {
  const { account, permission } = useSession(useShallow((s) => ({ account: s.account, permission: s.permission })))
  const player = usePlayer()
  const { currentWeek, weeks, query: weeksQuery } = useWeeks()
  const settings = useMissionSettings()
  const [claimed, setClaimed] = useState<number[]>([])
  const [busy, setBusy] = useState<string | null>(null)

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
    if (!account) return
    setBusy(`${weekId}-${withTlm}`)
    try {
      await transact([
        {
          account: CONTRACTS.MISSIONS,
          name: withTlm ? 'claimweektlm' : 'claimweek',
          authorization: [{ actor: account, permission }],
          data: withTlm ? { wallet: account, week_id: weekId } : { wallet: account, week_id: weekId, boost_percentage: 0 }
        }
      ])
      setClaimed((prev) => [...prev, weekId])
      toast.success('Claim successfully!')
      await sleep(3000)
      await Promise.all([refreshPlayer(account), weeksQuery.refetch()])
    } catch (err) {
      if (!isUserCancel(err)) toast.error(formatTransactError(err))
    } finally {
      setBusy(null)
    }
  }

  const cost = settings.data?.cost_nftpoints_claim ?? 0

  return (
    <>
      <PageHeader title="Weekly Rewards" image={publicUrl('/assets/background/bg-week-rewards.jpeg')} />

      <div className="page week-reward">
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
                      isLoading={busy === `${card.weekId}-false`}
                      disabled={!!busy || player.mcPoints < cost}
                      title={player.mcPoints < cost ? `${cost.toLocaleString('en-US')} MC Points` : undefined}
                      onClick={() => claim(card.weekId, false)}
                    >
                      <span className="num">{cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>{' '}
                      <StarSVG color="#fff" />
                    </Button>
                    <Button
                      block
                      isLoading={busy === `${card.weekId}-true`}
                      disabled={!!busy}
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
