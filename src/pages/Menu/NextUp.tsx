import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { nextAdventureAt, useAdventures, useAdventureSettings } from '@/data/adventures'
import { useBuilderSeason } from '@/data/builder'
import { useQuests } from '@/data/game'
import { useMembership, useUserWeeklies } from '@/data/player'
import { useMinerClaim } from '@/data/toolLoaning'
import { useClaimableWeeks, useLandComms, useLandPayouts } from '@/data/vault'
import Exclamation2SVG from '@/icons/exclamation2'
import GiftSVG from '@/icons/gift'
import MCPBuilderSVG from '@/icons/mcp-builder'
import RocketSVG from '@/icons/rocket'
import TriliumVaultSVG from '@/icons/trilium-vault'
import { tlmToNumber } from '@/lib/format'
import { chainDate, shortDuration, useClockFor } from '@/lib/time'
import { Ticking } from '@/components/Ticking'
import { useAccount } from '@/state/session'

const DAY = 86_400_000

interface Action {
  to: string
  title: string
  icon: ReactNode
  /** The one line that answers "can I do this now?". */
  state: ReactNode
  detail: ReactNode
  ready: boolean
}

/** What the player can actually do right now, in one place. */
export function NextUp() {
  const account = useAccount()
  const player = useMembership()

  const quests = useQuests()
  const weeklies = useUserWeeklies(account)
  const adventures = useAdventures(account)
  const adventureSettings = useAdventureSettings()
  const season = useBuilderSeason()
  const minerClaim = useMinerClaim(account)
  const comms = useLandComms(account)
  const payouts = useLandPayouts(account)
  const weeks = useClaimableWeeks()

  // Daily claim: members.mc allows one per UTC day.
  const lastClaim = player.member?.last_bgaction ? +chainDate(player.member.last_bgaction) : 0
  const dailyReadyAt = lastClaim ? Math.floor(lastClaim / DAY) * DAY + DAY : 0
  const seasonStart = season.data ? +chainDate(season.data.season_start) : 0
  const seasonEnd = season.data ? +chainDate(season.data.season_end) : 0

  // Every moment a card here changes (quests open or close, rewards unlock, adventures close or
  // appear, the daily claim, the season): re-render then. The countdowns tick on their own.
  const now = useClockFor([
    ...(quests.data ?? []).flatMap((quest) => [+chainDate(quest.quest_start_date), +chainDate(quest.quest_end_date)]),
    minerClaim.data ? +chainDate(minerClaim.data.timestamp) : undefined,
    ...adventures.open.map((adventure) => +chainDate(adventure.enter_end)),
    nextAdventureAt(adventures.all, adventureSettings.data?.auto_create_hours, Date.now()),
    dailyReadyAt,
    seasonStart,
    seasonEnd
  ])

  // Quests: what is live this week, and how much of it is done.
  const currentWeekly = weeklies.current
  const questCounts = useMemo(() => {
    const done = currentWeekly?.quest_id_array ?? []
    const live = (quests.data ?? []).filter(
      (quest) => +chainDate(quest.quest_start_date) <= now && +chainDate(quest.quest_end_date) > now
    )
    const completed = live.filter(
      (quest) => done.filter((id) => Number(id) === quest.quest_id).length >= quest.quest_max_completions
    ).length
    return { total: live.length, completed, open: live.length - completed }
  }, [quests.data, currentWeekly, now])

  // Claimable TLM: the same four sources the Vault adds up.
  const claimable =
    (minerClaim.data && +chainDate(minerClaim.data.timestamp) <= now ? tlmToNumber(minerClaim.data.amount) : 0) +
    tlmToNumber(comms.data?.comms) +
    tlmToNumber(payouts.data?.payoutAmount) +
    weeks.total

  const openAdventures = adventures.open.filter((adventure) => +chainDate(adventure.enter_end) > now)
  const nextAdventure = nextAdventureAt(adventures.all, adventureSettings.data?.auto_create_hours, now)

  const dailyReady = dailyReadyAt <= now

  const seasonLive = !!season.data && now >= seasonStart && now < seasonEnd

  const actions: Action[] = [
    {
      to: '/questing',
      title: 'Weekly Quests',
      icon: <Exclamation2SVG color="#ff4f6b" />,
      state: quests.isLoading ? '…' : questCounts.open > 0 ? `${questCounts.open} open` : 'All done',
      detail: quests.isLoading ? '' : `${questCounts.completed} of ${questCounts.total} completed`,
      ready: questCounts.open > 0
    },
    {
      to: '/trilium-vault',
      title: 'Rewards',
      icon: <TriliumVaultSVG color="#26d7ff" />,
      state: `${claimable.toFixed(4)} TLM`,
      detail: claimable > 0 ? 'Ready to claim' : 'Nothing to claim yet',
      ready: claimable > 0
    },
    {
      to: '/adventures',
      title: 'Adventures',
      icon: <RocketSVG color1="#00A3FF" color2="#E75300" />,
      state: adventures.isLoading ? '…' : openAdventures.length > 0 ? `${openAdventures.length} open` : 'None open',
      detail:
        nextAdventure > now ? (
          <Ticking render={(tick) => `Next in ${shortDuration(nextAdventure - tick)}`} />
        ) : openAdventures.length > 0 ? (
          'Send in your NFTs'
        ) : (
          ''
        ),
      ready: openAdventures.length > 0
    },
    {
      to: '/daily-rewards',
      title: 'Daily Claim',
      icon: <GiftSVG />,
      state: dailyReady ? 'Available' : <Ticking render={(tick) => shortDuration(dailyReadyAt - tick)} />,
      detail: dailyReady ? 'Spin the wheel' : 'Until the next spin',
      ready: dailyReady
    },
    {
      to: '/builder',
      title: 'Builder',
      icon: <MCPBuilderSVG />,
      state: season.isLoading ? (
        '…'
      ) : seasonLive ? (
        'Live'
      ) : seasonStart > now ? (
        <Ticking render={(tick) => shortDuration(seasonStart - tick)} />
      ) : (
        'Between seasons'
      ),
      detail: seasonLive ? (
        <Ticking render={(tick) => `Ends in ${shortDuration(seasonEnd - tick)}`} />
      ) : seasonStart > now ? (
        'Until the season starts'
      ) : (
        'Next season not announced'
      ),
      ready: seasonLive
    }
  ]

  return (
    <section className="next">
      <h2 className="next__title">WHAT YOU CAN DO</h2>
      <div className="next__grid">
        {actions.map((action) => (
          <Link key={action.to} to={action.to} className={`next-card ${action.ready ? 'is-ready' : ''}`}>
            <span className="next-card__icon">{action.icon}</span>
            <span className="next-card__title">{action.title}</span>
            <span className="next-card__state num">{action.state}</span>
            <span className="next-card__detail num">{action.detail}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
