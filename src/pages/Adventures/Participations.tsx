import { useState, type ReactNode } from 'react'

import { Button } from '@/components/Button'
import { CheckSquareIcon } from '@/components/icons'
import { estimatedRp, refreshAdventures, type Participation } from '@/data/adventures'
import type { AdvTemplate } from '@/data/types'
import QuestSVG from '@/icons/quest'
import { chainDate, timeLeft } from '@/lib/time'
import { claimAdventureAction } from '@/mining/actions'
import { useChainAction } from '@/pages/AwMining/useMemberAction'

import { AdventureImg, CardImg, countdown, SponsorRibbon, Stat } from './shared'

type Templates = Map<number, AdvTemplate>

export function RunningList({ items, templates, now }: { items: Participation[]; templates: Templates; now: number }) {
  if (items.length === 0) return <div className="panel adv-empty">No adventure running</div>

  return (
    <div className="adv-list">
      {items.map((p) => (
        <ParticipationCard
          key={p.pid}
          participation={p}
          templates={templates}
          eyebrow={`Returning in ${countdown(timeLeft(+chainDate(p.return_date), now))}`}
          rpLabel="Current RP Estimation"
        />
      ))}
    </div>
  )
}

export function ClaimableList({ items, templates }: { items: Participation[]; templates: Templates }) {
  const { run, busy, account } = useChainAction()
  const [pending, setPending] = useState<number | null>(null)
  // Hide a claimed adventure right away; the chain can take a moment to drop it.
  const [claimed, setClaimed] = useState<number[]>([])

  const visible = items.filter((p) => !claimed.includes(p.pid))

  async function claim(p: Participation) {
    setPending(p.pid)
    const ok = await run((a, perm) => claimAdventureAction(a, perm, p.adventureid), 'Adventure claimed successfully', () =>
      refreshAdventures(account)
    )
    if (ok) setClaimed((ids) => [...ids, p.pid])
    setPending(null)
  }

  if (visible.length === 0) return <div className="panel adv-empty">No adventure available to claim</div>

  return (
    <div className="adv-list">
      {visible.map((p) => (
        <ParticipationCard
          key={p.pid}
          participation={p}
          templates={templates}
          done
          eyebrow={
            <>
              Mission Completed <CheckSquareIcon />
            </>
          }
          rpLabel="Expected RP rewards"
          action={
            <Button block color="gradientPink" isLoading={pending === p.pid} disabled={busy} onClick={() => claim(p)}>
              Claim NFTs & Rewards
            </Button>
          }
        />
      ))}
    </div>
  )
}

interface CardProps {
  participation: Participation
  templates: Templates
  eyebrow: ReactNode
  rpLabel: string
  action?: ReactNode
  /** The adventure is back: the status light stops blinking.  */
  done?: boolean
}

function ParticipationCard({ participation: p, templates, eyebrow, rpLabel, action, done }: CardProps) {
  const adventure = p.adventure
  const rp = estimatedRp(p.score, adventure?.score_total ?? 0, adventure?.reward_qp ?? 0)

  return (
    <article className="panel adv-card">
      <div className="adv-card__main">
        <p className={`adv-status num ${done ? 'is-done' : ''}`}>{eyebrow}</p>
        <h2 className="adv-card__title">{adventure?.title ?? '…'}</h2>
        <div className="adv-card__data">
          <Stat label={rpLabel} value={rp} icon={<QuestSVG />} />
          <Stat label="Players" value={adventure?.players ?? '-'} />
        </div>
        <div className="adv-cards">
          {[0, 1, 2].map((i) => {
            const id = p.template_ids[i]
            return (
              <div key={i} className="adv-cards__card">
                <CardImg templateId={id} template={id ? templates.get(id) : undefined} />
              </div>
            )
          })}
        </div>
      </div>

      <div className="adv-card__side">
        <div className="adv-media">
          {adventure && <SponsorRibbon adventure={adventure} />}
          {adventure && <AdventureImg image={adventure.image} />}
        </div>
        {action}
      </div>
    </article>
  )
}
