import { useState } from 'react'
import type { AnyAction } from '@wharfkit/session'

import { Button } from '@/components/Button'
import {
  BUILDER_INFO_URL,
  buildingImage,
  cooldownEnd,
  currentResources,
  exploderGrant,
  exploderUses,
  formatR,
  msUntilFull,
  refreshBuilder,
  splitBuildings,
  useBuilderSettings,
  useBuildingDefs
} from '@/data/builder'
import type { BuilderPlayer, BuilderSeason, BuilderSettings, BuildingDef, PlayerBuilding } from '@/data/types/builder'
import LeaderBoardSvg from '@/icons/leaderboard'
import ShardsSVG from '@/icons/shards'
import StarSVG from '@/icons/star'
import { chainDate, cooldownLabel, shortDuration, timeLeft, useNow } from '@/lib/time'
import { exploderAction, upgradeBuildingAction } from '@/mining/actions'
import { useChainAction } from '@/pages/AwMining/useMemberAction'

import { BuildingDialog } from './BuildingDetail'
import { LeaderboardDialog } from './Leaderboard'
import { NftImg } from './shared'

interface OverviewProps {
  player: BuilderPlayer
  season: BuilderSeason
}

export function Overview({ player, season }: OverviewProps) {
  // Buttons, bars and cooldowns only need the second; the live counter ticks on its own.
  const now = useNow()
  const settings = useBuilderSettings()
  const defs = useBuildingDefs()
  const { run, busy } = useChainAction()
  const [pending, setPending] = useState<string | null>(null)
  // Both open over the outpost instead of taking the player to another page.
  const [openId, setOpenId] = useState<string | null>(null)
  const [board, setBoard] = useState(false)

  const resources = currentResources(player, now)
  const { production, special } = splitBuildings(player.buildings)
  const left = timeLeft(+chainDate(season.season_end), now)
  const fill = player.max_gamecurrency > 0 ? (resources / player.max_gamecurrency) * 100 : 0
  const toFull = msUntilFull(player, now)

  async function act(key: string, build: (account: string, permission: string) => AnyAction, success: string) {
    setPending(key)
    await run(build, success, refreshBuilder)
    setPending(null)
  }

  const upgrade = (b: PlayerBuilding) =>
    act(`up:${b.buildingid}`, (a, p) => upgradeBuildingAction(a, p, b.buildingid), 'Upgrade successful')

  const defFor = (b: PlayerBuilding) => defs.data?.find((d) => d.buildingid === b.buildingid)
  const shared = { resources, busy, pending, onUpgrade: upgrade, onOpen: setOpenId }
  const opened = openId ? player.buildings.find((b) => b.buildingid === openId) : undefined

  return (
    <>
      <p className="builder-hud__season num">
        SEASON ENDS IN {left.days}d {left.hours}h {left.minutes}min
      </p>

      <section className="builder-hud">
        <div className="builder-hud__plate builder-hud__storage">
          <p className="builder-hud__resources num">
            Я <LiveResources player={player} /> <small>/ {formatR(player.max_gamecurrency)}</small>
          </p>
          <div className={`builder-meter ${fill >= 100 ? 'is-full' : ''}`} aria-hidden>
            <span style={{ width: `${fill}%` }} />
          </div>
          <p className="builder-hud__rate num">
            <span>per minute: {formatR(player.gamecurrency_per_minute)}</span>
            {toFull > 0 ? (
              <span>full in {shortDuration(toFull)}</span>
            ) : (
              /* Nothing is coming in any more: that is worth saying, not hiding. */
              fill >= 100 && <span className="builder-hud__done">storage full</span>
            )}
          </p>
        </div>

        {season.season_mcp_rewards > 0 ? (
          <div className="builder-hud__plate builder-hud__prize">
            <span className="builder-hud__label">SEASON PRIZE POOL</span>
            <span className="builder-hud__pool num">
              <span>
                {((settings.data?.season_shards ?? 1) / 10).toLocaleString('en-US')} <ShardsSVG color="#EBB309" />
              </span>
              <span>
                {season.season_mcp_rewards.toLocaleString('en-US')} <StarSVG />
              </span>
            </span>
          </div>
        ) : (
          <a className="builder-hud__link" href={BUILDER_INFO_URL} target="_blank" rel="noreferrer">
            What is the Outpost Builder?
          </a>
        )}

        <button type="button" className="builder-hud__leaderboard" onClick={() => setBoard(true)}>
          LEADERBOARD <LeaderBoardSvg />
        </button>
      </section>

      <div className="builder-columns">
        <section className="builder-group">
          <h2 className="builder-group__title">PRODUCTION BUILDINGS</h2>
          {production.map((b) => (
            <BuildingCard key={b.buildingid} building={b} def={defFor(b)} player={player} {...shared} />
          ))}
        </section>

        <section className="builder-group">
          <h2 className="builder-group__title">SPECIAL BUILDINGS</h2>
          {special.map((b) => (
            <BuildingCard
              key={b.buildingid}
              building={b}
              def={defFor(b)}
              player={player}
              settings={settings.data}
              now={now}
              onExplode={() => act('exploder', exploderAction, 'Exploder used successfully')}
              {...shared}
            />
          ))}
        </section>
      </div>

      {opened && <BuildingDialog player={player} building={opened} onClose={() => setOpenId(null)} />}
      {board && <LeaderboardDialog player={player} onClose={() => setBoard(false)} />}
    </>
  )
}

/** Resources count up continuously, so only this number re-renders ten times a second. */
function LiveResources({ player }: { player: BuilderPlayer }) {
  const now = useNow(100)
  return <>{formatR(currentResources(player, now))}</>
}

interface CardProps {
  building: PlayerBuilding
  def: BuildingDef | undefined
  resources: number
  busy: boolean
  pending: string | null
  onUpgrade: (b: PlayerBuilding) => void
  onOpen: (id: string) => void
  player: BuilderPlayer
  /** Special buildings only. */
  settings?: BuilderSettings | null
  now?: number
  onExplode?: () => void
}

function BuildingCard({
  building,
  def,
  resources,
  busy,
  pending,
  onUpgrade,
  onOpen,
  player,
  settings,
  now,
  onExplode
}: CardProps) {
  const locked = building.building_level === 0
  const cost = building.gamecurrency_upgrade_cost
  const affordable = resources >= cost
  const isExploder = building.buildingid === 'faucet'
  const isSpecial = building.building_type !== 'production'

  const perDay = settings?.manual_mines_per_day ?? 10
  const uses = isExploder && now ? exploderUses(building, now) : 0
  const readyAt = isExploder ? cooldownEnd(building.last_interaction, settings?.seconds_mine_cd) : 0
  const cooling = !!now && readyAt > now
  const exploderReady = !busy && !!settings && !locked && resources < player.max_gamecurrency && uses < perDay && !cooling

  // How long the storage still needs to fill for this upgrade — or that it never will.
  const overStorage = cost > player.max_gamecurrency
  const rate = player.gamecurrency_per_minute
  const waitMs = affordable || overStorage || rate <= 0 ? 0 : ((cost - resources) / rate) * 60_000
  const wait = overStorage ? 'not enough storage' : waitMs > 0 ? shortDuration(waitMs) : ''

  const description =
    isExploder && player && now
      ? `Use up to ${perDay} times per day. Using it now would grant ${formatR(exploderGrant(building, player, now))} Я. Amount based on your Я per minute and Exploder level.`
      : def?.building_description

  return (
    <article className={`bld ${locked ? 'is-locked' : ''} ${isSpecial ? 'bld--special' : ''}`}>
      <button type="button" className="bld__art" onClick={() => onOpen(building.buildingid)} aria-label={building.building_name}>
        <img src={buildingImage(building.buildingid)} alt="" loading="lazy" />
      </button>

      <div className="bld__body">
        <header className="bld__head">
          <button type="button" className="bld__name" onClick={() => onOpen(building.buildingid)}>
            {building.building_name}
          </button>
          <span className="bld__level num">Level {building.building_level}</span>
        </header>

        {building.building_type === 'production' && (
          <p className="bld__rate num">Я {formatR(building.gamecurrency_per_minute_boosted)}/min</p>
        )}
        {isSpecial && description && <p className="bld__desc">{description}</p>}

        <Sockets building={building} def={def} onOpen={onOpen} />
      </div>

      <div className="bld__actions">
        <div className="bld__upgrade">
          <span className="bld__cost num">Я {formatR(cost)}</span>
          <Button
            size="sm"
            block
            className={!busy && affordable ? 'btn--charged btn--soft' : ''}
            isLoading={pending === `up:${building.buildingid}`}
            disabled={busy || !affordable}
            onClick={() => onUpgrade(building)}
          >
            {locked ? 'BUILD' : 'UPGRADE'}
          </Button>
          {/* Always rendered so every button in a row sits at the same height. */}
          <span className={`bld__afford ${affordable ? 'is-hidden' : ''}`} aria-hidden>
            <span style={{ width: `${Math.min(100, (resources / cost) * 100)}%` }} />
          </span>
          <span className={`bld__eta num ${overStorage ? 'is-blocked' : ''}`}>{wait}</span>
        </div>

        {isExploder && (
          <div className="bld__upgrade">
            <span className="bld__cost bld__cooldown num">{cooling ? cooldownLabel(readyAt, now!) : ' '}</span>
            <Button
              size="sm"
              block
              color="gradientPink"
              className={exploderReady ? 'btn--charged btn--soft' : ''}
              isLoading={pending === 'exploder'}
              disabled={!exploderReady}
              onClick={onExplode}
            >
              Use ({uses}/{perDay})
            </Button>
            <span className="bld__afford is-hidden" aria-hidden />
          </div>
        )}
      </div>
    </article>
  )
}

/** One socket per slot the building can ever hold: filled, open or still locked. */
function Sockets({
  building,
  def,
  onOpen
}: {
  building: PlayerBuilding
  def: BuildingDef | undefined
  onOpen: (id: string) => void
}) {
  const levels = def?.slot_unlock_levels ?? []
  if (levels.length === 0) return null
  const staked = building.staked_template_ids

  return (
    <div className="bld__sockets">
      {levels.map((level, i) => {
        const template = staked[i]
        const state = template ? 'is-filled' : building.building_level >= level ? 'is-open' : 'is-locked'
        return (
          <button
            key={i}
            type="button"
            className={`bsocket ${state}`}
            onClick={() => onOpen(building.buildingid)}
            title={template ? building.building_name : `Level ${level}`}
          >
            {template ? <NftImg templateId={template} /> : <span className="bsocket__level num">{level}</span>}
          </button>
        )
      })}
    </div>
  )
}
