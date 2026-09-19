import { useMemo } from 'react'

import {
  attackCooldownMs,
  effectivePower,
  teamOf,
  usePdDefenseWins,
  usePdPlayerMissions,
  usePdPower,
  usePdSupports
} from '@/data/planetaryDefense'
import ShardsSVG from '@/icons/shards'
import { formatDate, shortDuration } from '@/lib/time'
import { useAccount } from '@/state/session'

import { Plate } from './shared'

/** The player's power, role and record in attack and defense missions. */
export function PlayerStats() {
  const account = useAccount()
  const power = usePdPower(account)
  const supports = usePdSupports()
  const missions = usePdPlayerMissions(account)
  const wins = usePdDefenseWins()

  const row = power.data?.owner ?? power.data?.player
  const stats = effectivePower(row, !!power.data?.inForge)
  const isWarlord = !!power.data?.owner
  const team = account ? teamOf(supports.data ?? [], account) : null

  const attacks = useMemo(
    () => [...(missions.data ?? [])].sort((a, b) => b.last_participation_time - a.last_participation_time),
    [missions.data]
  )

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

  const totalAttackPoints = attacks.reduce((sum, a) => sum + a.attack_points, 0)
  const totalDefenseShards = defenses.reduce((sum, d) => sum + d.shards, 0)

  if (power.isLoading) return <div className="skeleton pd-card--skeleton" />

  return (
    <>
      <section className="pd-card">
        <header className="pd-card__head">
          <p className="pd-card__eyebrow">Player Stats</p>
          {power.data?.inForge && <span className="pd-state is-live">Forge</span>}
        </header>

        <div className="pd-plates pd-plates--stats">
          <Plate label="Attack" value={stats.attack.toLocaleString('en-US')} accent />
          <Plate label="Defense" value={stats.defense.toLocaleString('en-US')} accent />
          <Plate label="Move cost" value={stats.moveCost.toLocaleString('en-US')} />
          <Plate label="Attack cooldown" value={shortDuration(attackCooldownMs(stats.moveCost))} />
          <Plate
            label="Role"
            value={isWarlord ? `Warlord · ${stats.lands} lands` : team ? `Supporter of ${team.owner_address}` : 'No team'}
          />
          <Plate label="Attack points, all missions" value={totalAttackPoints.toLocaleString('en-US')} />
          <Plate
            label="Shards from defense"
            value={totalDefenseShards.toLocaleString('en-US')}
            icon={<ShardsSVG color="#ebb309" />}
          />
        </div>
      </section>

      <section className="pd-card">
        <p className="pd-card__eyebrow">Attack Missions</p>
        {missions.isLoading ? (
          <div className="skeleton pd-team--skeleton" />
        ) : attacks.length === 0 ? (
          <p className="pd-empty">No attacks yet</p>
        ) : (
          <ul className="pd-list">
            {attacks.map((a) => (
              <li key={a.id} className="pd-row">
                <span className="pd-row__name">{a.mission_name}</span>
                <span className="pd-row__meta num">{formatDate(new Date(a.last_participation_time * 1000))}</span>
                <span className="pd-row__value num">{a.attack_points.toLocaleString('en-US')}</span>
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
            {defenses.map(({ win, shards }) => (
              <li key={win.id} className="pd-row">
                <span className="pd-row__name">{win.mission_name}</span>
                <span className="pd-row__meta">{win.owner_address === account ? 'Warlord' : win.owner_address}</span>
                <span className="pd-row__value num">
                  {shards.toLocaleString('en-US')} <ShardsSVG color="#ebb309" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
