import { useMemo, useState } from 'react'

import { Button } from '@/components/Button'
import { Select } from '@/components/Select'
import { Ticking } from '@/components/Ticking'
import {
  acceptedRequest,
  attackCooldownMs,
  attackReadyAt,
  currentMission,
  effectivePower,
  isOpenRequest,
  missionShare,
  missionState,
  refreshPlanetaryDefense,
  teamOf,
  usePdDefenseMissions,
  usePdMissions,
  usePdOwners,
  usePdPlayerMissions,
  usePdPower,
  usePdRequests,
  usePdSupports
} from '@/data/planetaryDefense'
import type { PdOwner } from '@/data/types/planetaryDefense'
import ShardsSVG from '@/icons/shards'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { chainDate, cooldownLabel, countdown, shortDuration, timeLeft, useClockFor } from '@/lib/time'
import {
  pdAttackAction,
  pdCancelRequestAction,
  pdLeaveTeamAction,
  pdRemoveSupporterAction,
  pdRequestAction,
  pdRespondAction
} from '@/chain/actions/planetaryDefense'
import { useTransaction } from '@/wallet/useTransaction'

import { Meter, Plate } from './shared'

/** The current attack mission: progress, rewards, the player's share, their stats and the Attack button. */
export function AttackMission() {
  const { run, busy, pending, account } = useTransaction()
  const missions = usePdMissions()
  const mine = usePdPlayerMissions(account)
  const power = usePdPower(account)

  const mission = currentMission(missions.data ?? [], Date.now())
  const deadline = mission ? +chainDate(mission.deadline) : 0
  const myPart = mission ? mine.data?.find((row) => row.mission_name === mission.mission_name) : undefined
  const { attack, moveCost } = effectivePower(power.data?.owner ?? power.data?.player, !!power.data?.inForge)
  // The next attack: 3 hours + 10 s per move cost point after the last one on this mission.
  const readyAt = attackReadyAt(myPart?.last_participation_time, moveCost)
  // Re-render when the mission closes or the cooldown ends; the countdowns tick on their own.
  const now = useClockFor([deadline, readyAt])
  const state = mission ? missionState(mission, now) : null
  const cooling = readyAt > now

  if (missions.isLoading) return <div className="skeleton pd-card--skeleton" />

  if (!mission)
    return (
      <section className="pd-card">
        <p className="pd-card__eyebrow">Attack Mission</p>
        <p className="pd-empty">No attack mission yet</p>
      </section>
    )

  const live = state === 'live'
  const rewardTlm = tlmToNumber(mission.reward)
  const points = myPart?.attack_points ?? 0
  const share = missionShare(points, mission.total_attack_points, rewardTlm, mission.shards)

  return (
    <section className={`pd-card pd-card--attack ${live ? 'is-live' : ''}`}>
      <header className="pd-card__head">
        <p className="pd-card__eyebrow">Attack Mission</p>
        <span className={`pd-state is-${state}`}>
          {live ? (
            <Ticking render={(tick) => `ends in ${countdown(timeLeft(deadline, tick))}`} />
          ) : state === 'completed' ? (
            'Completed'
          ) : (
            'Ended'
          )}
        </span>
      </header>

      <div className="pd-card__top">
        <h2 className="pd-card__title">{mission.mission_name}</h2>
        <Meter value={mission.total_attack_points} max={mission.target_attack_points} tone="attack" />
      </div>

      <Rewards tlm={rewardTlm} shards={mission.shards} />

      {/* What the player brought, and what it is worth: rewards are split by share of attack points. */}
      <div className={`pd-mine ${points > 0 ? 'is-in' : ''}`}>
        <div className="pd-mine__head">
          <span className="pd-mine__label">Your contribution</span>
          <span className="pd-mine__share num">{formatShare(share.share)}</span>
        </div>
        <strong className="pd-mine__points num">{points.toLocaleString('en-US')}</strong>
        <span className="pd-mine__bar" aria-hidden>
          <span style={{ width: `${Math.min(100, share.share * 100)}%` }} />
        </span>
        <div className="pd-mine__earn num">
          <span>
            <TLMSVG /> {state === 'ended' ? 0 : share.tlm.toLocaleString('en-US', { maximumFractionDigits: 2 })} TLM
          </span>
          <span>
            <ShardsSVG color="#ebb309" />{' '}
            {state === 'ended' ? 0 : share.shards.toLocaleString('en-US', { maximumFractionDigits: 0 })} Shards
          </span>
        </div>
      </div>

      <div className="pd-plates pd-plates--stats">
        <Plate label="Attack power" value={attack.toLocaleString('en-US')} />
        <Plate label="Move cost" value={moveCost.toLocaleString('en-US')} />
        <Plate label="Cooldown" value={shortDuration(attackCooldownMs(moveCost))} />
      </div>

      <div className="pd-card__foot">
        {myPart && (
          <p className="pd-note num">
            Last attack <Ticking render={(tick) => `${shortDuration(tick - myPart.last_participation_time * 1000)} ago`} />
          </p>
        )}
        <Button
          color="gradientOrange"
          className="pd-action"
          isLoading={pending === 'attack'}
          disabled={busy || !live || attack <= 0 || cooling}
          onClick={() =>
            run((a, p) => pdAttackAction(a, p, mission.mission_name), 'Attack sent', refreshPlanetaryDefense, 'attack')
          }
        >
          <span className="num">
            {live && cooling ? <Ticking render={(tick) => cooldownLabel(readyAt, tick, 'Attack')} /> : 'Attack'}
          </span>
        </Button>
      </div>
    </section>
  )
}

const formatShare = (share: number) => `${(share * 100).toFixed(share >= 0.1 ? 1 : 2)}%`

/** A mission's rewards: the TLM and shards it pays out, set apart from the player's own figures. */
function Rewards({ tlm, shards }: { tlm: number; shards?: number }) {
  return (
    <div className="pd-rewards">
      <span className="pd-rewards__label">Rewards</span>
      <div className="pd-rewards__items">
        <span className="pd-reward num">
          <TLMSVG />
          <strong>{tlm.toLocaleString('en-US', { maximumFractionDigits: 2 })}</strong>
          <small>TLM</small>
        </span>
        {shards !== undefined && (
          <span className="pd-reward num">
            <ShardsSVG color="#ebb309" />
            <strong>{shards.toLocaleString('en-US')}</strong>
            <small>Shards</small>
          </span>
        )}
      </div>
    </div>
  )
}

/** Land defense: the running defense mission and the player's warlord team. */
export function LandDefense() {
  const { account } = useTransaction()
  const power = usePdPower(account)
  const supports = usePdSupports()
  const defense = usePdDefenseMissions()
  const owners = usePdOwners()

  const isWarlord = !!power.data?.owner
  const team = account
    ? isWarlord
      ? ((supports.data ?? []).find((row) => row.owner_address === account) ?? null)
      : teamOf(supports.data ?? [], account)
    : null
  const warlord = team ? owners.data?.find((o) => o.owner_address === team.owner_address) : undefined
  const mission = defense.data?.[0]
  const target = mission ? mission.target * Math.max(1, warlord?.numberofland ?? 1) : 0

  return (
    <section className="pd-card pd-card--defense">
      <header className="pd-card__head">
        <p className="pd-card__eyebrow">Land Defense</p>
        {mission && <span className="pd-state is-live">Live</span>}
      </header>

      <div className="pd-card__top">
        {mission ? (
          <>
            <h2 className="pd-card__title">{mission.mission_name}</h2>
            <Meter value={team?.total_defense_score ?? 0} max={target} tone="defense" />
          </>
        ) : (
          <p className="pd-empty">No defense mission running</p>
        )}
      </div>

      {/* Keeps the rows lined up with the attack card when there is no defense reward to show. */}
      {mission ? <Rewards tlm={mission.rewards} /> : <div className="pd-rewards--none" />}

      <div className="pd-card__team">
        {power.isLoading || supports.isLoading ? (
          <div className="skeleton pd-team--skeleton" />
        ) : isWarlord ? (
          <WarlordTeam />
        ) : team ? (
          <SupporterTeam warlord={team.owner_address} score={team.total_defense_score} size={team.supporters.length} />
        ) : (
          <FindWarlord owners={owners.data ?? []} />
        )}
      </div>
    </section>
  )
}

/** A warlord's own team: supporters, incoming requests to answer. */
function WarlordTeam() {
  const { run, busy, pending, account } = useTransaction()
  const supports = usePdSupports()
  const requests = usePdRequests(account, 'warlord')
  const now = useClockFor([])

  const team = (supports.data ?? []).find((row) => row.owner_address === account)
  const open = (requests.data ?? []).filter((r) => isOpenRequest(r, now))

  return (
    <div className="pd-team">
      <div className="pd-plates">
        <Plate label="Your role" value="Warlord" accent />
        <Plate label="Team defense" value={(team?.total_defense_score ?? 0).toLocaleString('en-US')} />
        <Plate label="Supporters" value={String(team?.supporters.length ?? 0)} />
      </div>

      {open.length > 0 && (
        <ul className="pd-list">
          {open.map((request) => (
            <li key={request.request_id} className="pd-row">
              <span className="pd-row__name">{request.player}</span>
              <span className="pd-row__actions">
                <Button
                  size="sm"
                  isLoading={pending === `accept-${request.request_id}`}
                  disabled={busy}
                  onClick={() =>
                    run(
                      (a, p) => pdRespondAction(a, p, request.request_id, true),
                      'Request accepted',
                      refreshPlanetaryDefense,
                      `accept-${request.request_id}`
                    )
                  }
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  color="ghost"
                  isLoading={pending === `decline-${request.request_id}`}
                  disabled={busy}
                  onClick={() =>
                    run(
                      (a, p) => pdRespondAction(a, p, request.request_id, false),
                      'Request declined',
                      refreshPlanetaryDefense,
                      `decline-${request.request_id}`
                    )
                  }
                >
                  Decline
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {(team?.supporters.length ?? 0) > 0 && (
        <ul className="pd-list">
          {team!.supporters.map((player) => {
            const request = acceptedRequest(requests.data ?? [], player, account ?? '')
            return (
              <li key={player} className="pd-row">
                <span className="pd-row__name">{player}</span>
                <Button
                  size="sm"
                  color="ghost"
                  isLoading={pending === `remove-${player}`}
                  disabled={busy || !request}
                  onClick={() =>
                    run(
                      (a, p) => pdRemoveSupporterAction(a, p, player, request!.request_id),
                      'Supporter removed',
                      refreshPlanetaryDefense,
                      `remove-${player}`
                    )
                  }
                >
                  Remove
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** A supporter's team: whose, how strong, and the way out. */
function SupporterTeam({ warlord, score, size }: { warlord: string; score: number; size: number }) {
  const { run, busy, pending, account } = useTransaction()
  const requests = usePdRequests(account, 'player')
  const request = acceptedRequest(requests.data ?? [], account ?? '', warlord)

  return (
    <div className="pd-team">
      <div className="pd-plates">
        <Plate label="Your warlord" value={warlord} accent />
        <Plate label="Team defense" value={score.toLocaleString('en-US')} />
        <Plate label="Supporters" value={String(size)} />
      </div>
      <Button
        size="sm"
        color="ghost"
        className="pd-action"
        isLoading={pending === 'leave'}
        disabled={busy || !request}
        onClick={() =>
          run((a, p) => pdLeaveTeamAction(a, p, request!.request_id), 'You left the team', refreshPlanetaryDefense, 'leave')
        }
      >
        Leave team
      </Button>
    </div>
  )
}

/** No team yet: a pending request to cancel, or a warlord to ask. */
function FindWarlord({ owners }: { owners: PdOwner[] }) {
  const { run, busy, pending, account } = useTransaction()
  const supports = usePdSupports()
  const requests = usePdRequests(account, 'player')
  const now = useClockFor([])
  const [choice, setChoice] = useState('')

  const waiting = (requests.data ?? []).find((r) => isOpenRequest(r, now))

  // Strongest teams first, so a player can see who is worth joining.
  const options = useMemo(() => {
    const score = new Map((supports.data ?? []).map((s) => [s.owner_address, s]))
    return owners
      .filter((o) => o.numberofland > 0)
      .map((o) => ({ owner: o, team: score.get(o.owner_address) }))
      .sort((a, b) => (b.team?.total_defense_score ?? 0) - (a.team?.total_defense_score ?? 0))
      .map(({ owner, team }) => ({
        value: owner.owner_address,
        label: `${owner.owner_address} · ${owner.numberofland} lands · ${(team?.total_defense_score ?? 0).toLocaleString('en-US')} def`
      }))
  }, [owners, supports.data])

  if (waiting)
    return (
      <div className="pd-team">
        <div className="pd-plates">
          <Plate label="Request sent to" value={waiting.warlord} accent />
          <Plate
            label="Expires in"
            value={<Ticking render={(tick) => shortDuration(+chainDate(waiting.expiration_time) - tick)} />}
          />
        </div>
        <Button
          size="sm"
          color="ghost"
          className="pd-action"
          isLoading={pending === 'cancel'}
          disabled={busy}
          onClick={() =>
            run((a, p) => pdCancelRequestAction(a, p, waiting.request_id), 'Request cancelled', refreshPlanetaryDefense, 'cancel')
          }
        >
          Cancel request
        </Button>
      </div>
    )

  return (
    <div className="pd-team pd-team--find">
      <Select
        value={choice}
        options={[{ value: '', label: 'Choose a warlord' }, ...options]}
        onChange={setChoice}
        ariaLabel="Warlord"
        className="pd-select"
      />
      <Button
        size="sm"
        className="pd-action"
        isLoading={pending === 'request'}
        disabled={busy || !choice}
        onClick={() => run((a, p) => pdRequestAction(a, p, choice), 'Request sent', refreshPlanetaryDefense, 'request')}
      >
        Send request
      </Button>
    </div>
  )
}
