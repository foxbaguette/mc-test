import { useMemo } from 'react'

import {
  attackCooldownMs,
  effectivePower,
  missionShare,
  usePdDefenseWins,
  usePdDefenseWinTimes,
  usePdMissions,
  usePdPlayerMissions,
  usePdPower
} from '@/data/planetaryDefense'
import ShardsSVG from '@/icons/shards'
import TLMSVG from '@/icons/tlm'
import { tlmToNumber } from '@/lib/format'
import { shortDuration, timeAgo, useNow } from '@/lib/time'
import { useAccount } from '@/state/session'

import { Plate } from './shared'

const fmt = (n: number, digits = 2) => n.toLocaleString('en-US', { maximumFractionDigits: digits })

/** The player's power, and what their attack missions and defense wins earned. */
export function PlayerStats() {
  const account = useAccount()
  const power = usePdPower(account)
  const missions = usePdMissions()
  const mine = usePdPlayerMissions(account)
  const wins = usePdDefenseWins()
  const winTimes = usePdDefenseWinTimes()
  // "5 min ago" style labels only need to move on once a minute.
  const now = useNow(60_000)

  const stats = effectivePower(power.data?.owner ?? power.data?.player, !!power.data?.inForge)

  // Each attack mission the player took part in, newest first, with their share of its rewards.
  // Rewards only come when the mission reaches its target; a live mission shows what it would pay.
  const attacks = useMemo(() => {
    const byName = new Map((missions.data ?? []).map((m) => [m.mission_name, m]))
    return [...(mine.data ?? [])]
      .sort((a, b) => b.last_participation_time - a.last_participation_time)
      .map((row) => {
        const mission = byName.get(row.mission_name)
        const paid = !!mission?.is_completed
        const share = mission
          ? missionShare(row.attack_points, mission.total_attack_points, tlmToNumber(mission.reward), mission.shards)
          : null
        return { row, tlm: paid ? (share?.tlm ?? 0) : 0, shards: paid ? (share?.shards ?? 0) : 0, paid }
      })
  }, [missions.data, mine.data])

  // Defense wins the player shared in: shards[0] is the warlord's, shards[i + 1] supporter i's.
  const defenses = useMemo(
    () =>
      (wins.data ?? [])
        .flatMap((win) => {
          if (win.owner_address === account) return [{ win, shards: win.shards[0] ?? 0 }]
          const i = win.supporters.indexOf(account ?? '')
          return i >= 0 ? [{ win, shards: win.shards[i + 1] ?? 0 }] : []
        })
        .sort((a, b) => b.win.id - a.win.id),
    [wins.data, account]
  )

  if (power.isLoading) return <div className="skeleton pd-card--skeleton" />

  return (
    <>
      <section className="pd-card">
        <header className="pd-card__head">
          <p className="pd-card__eyebrow">Player Stats</p>
          {power.data?.inForge && (
            <span
              className="pd-state is-live"
              title="Your Forge equips weapons and shields to your crew, raising attack and defense"
            >
              Forge · weapons equipped
            </span>
          )}
        </header>

        <div className="pd-plates pd-plates--stats pd-plates--four">
          <Plate label="Attack" value={fmt(stats.attack, 0)} accent />
          <Plate label="Defense" value={fmt(stats.defense, 0)} accent />
          <Plate label="Move cost" value={fmt(stats.moveCost, 0)} />
          <Plate label="Attack cooldown" value={shortDuration(attackCooldownMs(stats.moveCost))} />
        </div>
      </section>

      <section className="pd-card">
        <p className="pd-card__eyebrow">Attack Missions</p>
        {mine.isLoading || missions.isLoading ? (
          <div className="skeleton pd-team--skeleton" />
        ) : attacks.length === 0 ? (
          <p className="pd-empty">No attacks yet</p>
        ) : (
          <ul className="pd-list">
            {attacks.map(({ row, tlm, shards, paid }) => (
              <li key={row.id} className={`pd-row pd-earn ${paid ? '' : 'is-unpaid'}`}>
                <span className="pd-row__name">{timeAgo(row.last_participation_time * 1000, now)}</span>
                <span className="pd-earn__amount num">
                  {fmt(tlm)} <TLMSVG />
                </span>
                <span className="pd-earn__amount num">
                  {fmt(shards, 0)} <ShardsSVG color="#ebb309" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pd-card">
        <p className="pd-card__eyebrow">Defense Wins</p>
        {wins.isLoading ? (
          <div className="skeleton pd-team--skeleton" />
        ) : defenses.length === 0 ? (
          <p className="pd-empty">No defense wins yet</p>
        ) : (
          <ul className="pd-list">
            {defenses.map(({ win, shards }) => {
              const at = winTimes.data?.get(String(win.id))
              return (
                <li key={win.id} className="pd-row pd-earn">
                  <span className="pd-row__name">{at ? timeAgo(at, now) : '—'}</span>
                  <span className="pd-earn__amount num">
                    {fmt(shards, 0)} <ShardsSVG color="#ebb309" />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
