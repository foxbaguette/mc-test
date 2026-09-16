import { useState } from 'react'

import { Button } from '@/components/Button'
import { refreshBuilder } from '@/data/builder'
import type { BuilderSeason } from '@/data/types/builder'
import StarSVG from '@/icons/star'
import { chainDate, timeLeft, useNow } from '@/lib/time'
import { regPlayerAction } from '@/mining/actions'
import { useChainAction } from '@/pages/AwMining/useMemberAction'
import { publicUrl } from '@/lib/publicUrl'

import { PrevSeason } from './PrevSeason'

export function Welcome({ season }: { season: BuilderSeason | null }) {
  const now = useNow()
  const { run, busy } = useChainAction()
  const [tab, setTab] = useState<'new' | 'prev'>('new')

  let title = ''
  let note = ''
  let disabled = true
  if (season) {
    const start = +chainDate(season.season_start)
    const end = +chainDate(season.season_end)
    if (now < start) {
      const t = timeLeft(start, now)
      title = 'NEW SEASON STARTING SOON'
      note = `Next season starting in ${t.days} days ${t.hours} hours and ${t.minutes} minutes ${t.seconds} seconds`
    } else if (now >= end) {
      title = 'WE ARE WRAPPING UP THE PREVIOUS SEASON. RETURNING NFTS, SENDING PRIZES, ....'
    } else {
      const t = timeLeft(end, now)
      title = `SEASON ENDS IN ${t.days} DAYS ${t.hours} HOURS ${t.minutes} MINUTES ${t.seconds} SECONDS`
      disabled = false
    }
  }

  const showPrev = !!(season?.new_season_prepared || season?.ranking_cleared)

  return (
    <>
      {title && <h2 className="builder__status num">{title}</h2>}

      {showPrev && (
        <div className="builder__tabs">
          <div className="segmented" role="tablist" aria-label="Season">
            <button
              role="tab"
              aria-selected={tab === 'new'}
              className={tab === 'new' ? 'is-active' : ''}
              onClick={() => setTab('new')}
            >
              New Season
            </button>
            <button
              role="tab"
              aria-selected={tab === 'prev'}
              className={tab === 'prev' ? 'is-active' : ''}
              onClick={() => setTab('prev')}
            >
              Previous Season
            </button>
          </div>
        </div>
      )}

      {tab === 'prev' && showPrev ? (
        <PrevSeason />
      ) : (
        <section className="panel builder-welcome">
          <img className="builder-welcome__art" src={publicUrl('/assets/mcp/mcp-builder.png')} alt="" />
          <div className="builder-welcome__body">
            <h2 className="builder-welcome__title">
              WELCOME TO <br /> OUTPOST BUILDER
            </h2>
            <p>
              Mission Control needs YOU to help gain more resources. Build an outpost on a remote planet in this seasonal idle
              building game. Ramp up your production and deliver resources to Mission Control in exchange for <StarSVG />.
            </p>
            <p>
              Who will manage to deliver the most resources to Mission Control? Who will take up the challenge for the top of the
              leaderboard this season?
            </p>
            <p>Ready? Then what are you waiting for?</p>
            {note && <p className="builder-welcome__note num">{note}</p>}
            <Button
              size="lg"
              isLoading={busy}
              disabled={busy || disabled}
              onClick={() => run(regPlayerAction, '', refreshBuilder)}
            >
              START NOW !
            </Button>
          </div>
        </section>
      )}
    </>
  )
}
