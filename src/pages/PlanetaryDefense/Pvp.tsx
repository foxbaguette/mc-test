import { Button } from '@/components/Button'
import { Ticking } from '@/components/Ticking'
import { pdJoinPvpAction } from '@/chain/actions/planetaryDefense'
import { pvpJoinable, pvpPhaseEnd, pvpSide, refreshPlanetaryDefense, usePdChest, usePdPvp } from '@/data/planetaryDefense'
import type { PdPvp } from '@/data/types/planetaryDefense'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { countdown, timeLeft, useClockFor } from '@/lib/time'
import { useTransaction } from '@/wallet/useTransaction'

import { Plate } from './shared'

const PHASE_LABEL: Record<string, string> = { defense: 'Defense Phase', attack: 'Attack Phase', result: 'Result' }

/** The running PvP round: target, both sides' scores, and the way in; earlier rounds below. */
export function Pvp() {
  const { run, busy, pending, account } = useTransaction()
  const pvp = usePdPvp()
  const round = pvp.data?.[0]
  const end = round ? pvpPhaseEnd(round) : 0
  // Re-render when the phase closes; the countdown ticks on its own.
  const now = useClockFor([end])
  const chest = usePdChest(round?.land_id)

  if (pvp.isLoading) return <div className="skeleton pd-card--skeleton" />
  if (!round)
    return (
      <section className="pd-card">
        <p className="pd-card__eyebrow">PvP</p>
        <p className="pd-empty">No PvP round yet</p>
      </section>
    )

  const side = account ? pvpSide(round, account) : null
  const joinable = account ? pvpJoinable(round, account, now) : null
  const total = round.defense_score + round.attack_score
  const defensePct = total > 0 ? (round.defense_score / total) * 100 : 50

  return (
    <>
      <section className={`pd-card pd-card--pvp is-${round.phase}`}>
        <header className="pd-card__head">
          <p className="pd-card__eyebrow num">PvP #{round.id}</p>
          <span className={`pd-state ${end > now ? 'is-live' : 'is-completed'}`}>
            {end > now ? (
              <Ticking render={(tick) => `${PHASE_LABEL[round.phase] ?? round.phase} · ${countdown(timeLeft(end, tick))}`} />
            ) : (
              (PHASE_LABEL[round.phase] ?? round.phase)
            )}
          </span>
        </header>

        <h2 className="pd-card__title">{round.selected_player}</h2>

        <div className="pd-versus" aria-label="Scores">
          <div className="pd-versus__side is-defense">
            <span className="pd-versus__label">Defense</span>
            <strong className="num">{round.defense_score.toLocaleString('en-US')}</strong>
            <small className="num">{round.defense_list.length} players</small>
          </div>
          <div className="pd-versus__side is-attack">
            <span className="pd-versus__label">Attack</span>
            <strong className="num">{round.attack_score.toLocaleString('en-US')}</strong>
            <small className="num">{round.attack_list.length} players</small>
          </div>
          <span className="pd-versus__bar" aria-hidden>
            <span style={{ width: `${defensePct}%` }} />
          </span>
        </div>

        <div className="pd-plates pd-plates--stats">
          <Plate
            label="Rewards"
            value={tlmToNumber(round.rewards).toLocaleString('en-US', { maximumFractionDigits: 2 })}
            icon={<TLMSVG />}
            accent
          />
          <Plate label="Land" value={round.land_id} />
          {chest.data && <Plate label="Chest level" value={String(chest.data.chest_level)} />}
          {round.phase === 'result' && round.winner && (
            <Plate label="Winner" value={round.winner === 'defense' ? 'Defense' : 'Attack'} accent />
          )}
          {side && <Plate label="Your side" value={side === 'defense' ? 'Defense' : 'Attack'} />}
        </div>

        {joinable && (
          <Button
            color={joinable === 'defense' ? 'gradientBlue' : 'gradientOrange'}
            className="pd-action"
            isLoading={pending === 'pvp'}
            disabled={busy}
            onClick={() =>
              run(
                (a, p) => pdJoinPvpAction(a, p, round.id, joinable),
                joinable === 'defense' ? 'You joined the defense' : 'You joined the attack',
                refreshPlanetaryDefense,
                'pvp'
              )
            }
          >
            {joinable === 'defense' ? 'Join defense' : 'Join attack'}
          </Button>
        )}
      </section>

      {(pvp.data?.length ?? 0) > 1 && (
        <section className="pd-card">
          <p className="pd-card__eyebrow">Earlier Rounds</p>
          <ul className="pd-list">
            {pvp.data!.slice(1).map((r) => (
              <RoundRow key={r.id} round={r} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function RoundRow({ round }: { round: PdPvp }) {
  return (
    <li className="pd-row">
      <span className="pd-row__name num">
        #{round.id} {round.selected_player}
      </span>
      <span className={`pd-winner is-${round.winner}`}>
        {round.winner === 'defense' ? 'Defense' : round.winner ? 'Attack' : '—'}
      </span>
      <span className="pd-row__value num">
        {tlmToNumber(round.rewards).toLocaleString('en-US', { maximumFractionDigits: 2 })} <TLMSVG />
      </span>
    </li>
  )
}
