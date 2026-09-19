import { useState } from 'react'

import { Button } from '@/components/Button'
import { Ticking } from '@/components/Ticking'
import { pdJoinPvpAction } from '@/chain/actions/planetaryDefense'
import { useGamertag } from '@/data/player'
import {
  pvpJoinable,
  pvpPhaseEnd,
  pvpSide,
  refreshPlanetaryDefense,
  usePdPvp,
  usePdPvpRoster,
  type PvpContribution
} from '@/data/planetaryDefense'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { countdown, timeLeft, useClockFor } from '@/lib/time'
import { useTransaction } from '@/wallet/useTransaction'

import { Plate } from './shared'

const PHASE_LABEL: Record<string, string> = { defense: 'Defense Phase', attack: 'Attack Phase', result: 'Result' }

type Side = 'defense' | 'attack'

/** The running PvP round: the player under attack, both sides' scores, the way in, and who brought what. */
export function Pvp() {
  const { run, busy, pending, account } = useTransaction()
  const pvp = usePdPvp()
  const round = pvp.data?.[0]
  const roster = usePdPvpRoster(round?.id)
  const tag = useGamertag(round?.selected_player)
  // Which side's players show; until the player picks, their own side or the one whose phase runs.
  const [picked, setPicked] = useState<Side | null>(null)
  const end = round ? pvpPhaseEnd(round) : 0
  // Re-render when the phase closes; the countdown ticks on its own.
  const now = useClockFor([end])

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
  const shown: Side = picked ?? side ?? (round.phase === 'attack' ? 'attack' : 'defense')

  return (
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

      {/* The player under attack: their gamertag when they set one, the wallet beneath. */}
      <div className="pd-target">
        <h2 className="pd-card__title">{tag.data ?? round.selected_player}</h2>
        {tag.data && <p className="pd-target__wallet">{round.selected_player}</p>}
      </div>

      <div className="pd-versus" aria-label="Scores">
        <div className="pd-versus__side is-defense">
          <span className="pd-versus__label">Defense</span>
          <strong className="num">{round.defense_score.toLocaleString('en-US')}</strong>
        </div>
        <div className="pd-versus__side is-attack">
          <span className="pd-versus__label">Attack</span>
          <strong className="num">{round.attack_score.toLocaleString('en-US')}</strong>
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

      <div className={`pd-roster pd-roster--${shown}`}>
        <div className="segmented pd-roster__switch" role="tablist" aria-label="Players">
          {(['defense', 'attack'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={shown === s}
              className={`pd-roster__tab is-${s} ${shown === s ? 'is-active' : ''}`}
              onClick={() => setPicked(s)}
            >
              {s === 'defense' ? 'Defenders' : 'Attackers'}
              <span className="pd-roster__count num">{(s === 'defense' ? round.defense_list : round.attack_list).length}</span>
            </button>
          ))}
        </div>

        <Roster
          players={shown === 'defense' ? roster.data?.defense : roster.data?.attack}
          total={shown === 'defense' ? round.defense_score : round.attack_score}
          loading={roster.isLoading}
          you={account}
        />
      </div>
    </section>
  )
}

interface RosterProps {
  players: PvpContribution[] | undefined
  total: number
  loading: boolean
  you: string | null
}

/** One side of the round: every player and their share of the side's score, largest first. */
function Roster({ players, total, loading, you }: RosterProps) {
  if (loading) return <div className="skeleton pd-team--skeleton" />
  if (!players || players.length === 0) return <p className="pd-empty">No one yet</p>
  return (
    <ol className="pd-list pd-roster__list">
      {players.map(({ player, score }, i) => {
        const share = total > 0 ? (score / total) * 100 : 0
        return (
          <li key={player} className={`pd-row pd-roster__row ${player === you ? 'is-you' : ''}`}>
            <span className="pd-roster__rank num">{i + 1}</span>
            <span className="pd-row__name">{player}</span>
            <span className="pd-row__value num">{score.toLocaleString('en-US')}</span>
            <span className="pd-roster__share num">{share.toFixed(share >= 10 ? 0 : 1)}%</span>
            <span className="pd-roster__bar" aria-hidden>
              <span style={{ width: `${share}%` }} />
            </span>
          </li>
        )
      })}
    </ol>
  )
}
