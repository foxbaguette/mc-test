import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { RefreshIcon } from '@/components/icons'
import { Select } from '@/components/Select'
import { useCollectInfo, useQuests, useUserWeeklies } from '@/data/queries'
import QuestSVG from '@/icons/quest'
import { chainDate } from '@/lib/time'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import './Questing.css'

type Status = 'all' | 'available' | 'completed'

const STATUSES: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'completed', label: 'Completed' }
]

/** Short game names shown instead of logos, keyed by quest collection. */
const GAME_BADGES: Record<string, { short: string; tone: string }> = {
  ale: { short: 'ALE', tone: 'ale' },
  plandef: { short: 'PD', tone: 'pd' },
  mu: { short: 'MC', tone: 'mc' },
  mc: { short: 'MC', tone: 'mc' },
  mcadv: { short: 'MC', tone: 'mc' },
  mcbuilder: { short: 'MC', tone: 'mc' }
}

/** Mission Control's own collections share one entry in the game filter. */
const MC_COLLECTIONS = new Set(['mc', 'mcadv', 'mcbuilder', 'mu'])
const gameGroup = (collection: string) => (MC_COLLECTIONS.has(collection) ? 'mc' : collection)

const MC_NAMES: Record<string, string> = {
  mu: 'Mission Control Voting',
  mcadv: 'Mission Control Adventures',
  mcbuilder: 'Mission Control Builder'
}

/** Written-out game name. The chain names Mission Control's games "MC …"; the "mc" collection holds several features, told apart by the quest text. */
function gameName(quest: { quest_collection: string; game_real_name: string; quest_description: string }) {
  if (MC_NAMES[quest.quest_collection]) return MC_NAMES[quest.quest_collection]
  if (quest.quest_collection !== 'mc') return quest.game_real_name
  const text = quest.quest_description.toLowerCase()
  if (text.includes('tool loaning')) return 'Mission Control Tool Loaning'
  if (text.includes('daily bonus')) return 'Mission Control Daily Bonus'
  return 'Mission Control'
}

function GameBadge({ collection, name }: { collection: string; name: string }) {
  const badge = GAME_BADGES[collection]
  return (
    <span className={`quests__logo-fallback ${badge ? `quests__logo-fallback--${badge.tone}` : ''}`} aria-hidden>
      {badge?.short ?? name.slice(0, 2)}
    </span>
  )
}

export default function Questing() {
  const account = useAccount()
  const quests = useQuests()
  const collections = useCollectInfo()
  const weeklies = useUserWeeklies(account)
  const [status, setStatus] = useState<Status>('available')
  const [game, setGame] = useState('all')

  const completedIds = weeklies.current?.quest_id_array

  const rows = useMemo(() => {
    const now = Date.now()
    return (quests.data ?? [])
      .filter((quest) => +chainDate(quest.quest_end_date) > now)
      .map((quest) => ({
        ...quest,
        game_real_name: gameName(quest),
        isActive: +chainDate(quest.quest_start_date) <= now,
        completions: (completedIds ?? []).filter((id) => Number(id) === quest.quest_id).length
      }))
      .filter((quest) => game === 'all' || gameGroup(quest.quest_collection) === game)
      .filter((quest) => {
        const done = quest.completions >= quest.quest_max_completions
        if (status === 'available') return quest.isActive && !done
        if (status === 'completed') return done
        return true
      })
  }, [quests.data, completedIds, status, game])

  const gameOptions = useMemo(
    () => [
      { value: 'all', label: 'All Games' },
      // One "Mission Control" entry covers every Mission Control collection.
      ...[
        ...new Map(
          (collections.data ?? [])
            .filter((c) => quests.data?.some((q) => gameGroup(q.quest_collection) === gameGroup(c.collection)))
            .map((c) => [gameGroup(c.collection), gameGroup(c.collection) === 'mc' ? 'Mission Control' : c.colrealname] as const)
        )
      ].map(([value, label]) => ({ value, label }))
    ],
    [collections.data, quests.data]
  )

  const refreshing = weeklies.isFetching || quests.isFetching
  const loading = quests.isLoading || weeklies.isLoading

  return (
    <>
      <PageHeader title="Weekly Quests" image={publicUrl('/assets/background/bg-quest.jpeg')} />

      <div className="page questing">
        <div className="questing__toolbar">
          <div className="segmented" role="radiogroup" aria-label="Status">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                role="radio"
                aria-checked={status === s.value}
                className={status === s.value ? 'is-active' : ''}
                onClick={() => setStatus(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="questing__actions">
            <Select value={game} options={gameOptions} onChange={setGame} ariaLabel="Game" />
            <button
              className={`icon-btn ${refreshing ? 'is-spinning' : ''}`}
              onClick={() => Promise.all([quests.refetch(), weeklies.refetch()])}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshIcon />
            </button>
          </div>
        </div>

        <div className="panel quests">
          <div className="quests__head" aria-hidden>
            <span>Game</span>
            <span>Description</span>
            <span>Completions</span>
            <span>Questing Points</span>
          </div>

          {loading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="skeleton quests__loading" />)
          ) : rows.length === 0 ? (
            <p className="empty">No quest listing</p>
          ) : (
            <ul className="quests__list">
              {rows.map((quest) => {
                const pct = Math.min(100, (quest.completions / Math.max(1, quest.quest_max_completions)) * 100)
                const done = pct >= 100
                return (
                  <li key={quest.quest_id} className={`quests__row ${done ? 'is-done' : ''}`}>
                    <a className="quests__game" href={quest.game_website} target="_blank" rel="noreferrer">
                      <GameBadge collection={quest.quest_collection} name={quest.game_real_name} />
                      <span>{quest.game_real_name}</span>
                    </a>
                    <p className="quests__desc">{quest.quest_description}</p>
                    <div className="quests__progress">
                      <span className="num">
                        {quest.completions}/{quest.quest_max_completions}
                      </span>
                      <span className="progress" role="progressbar" aria-valuenow={quest.completions} aria-valuemax={quest.quest_max_completions}>
                        <span style={{ width: `${pct}%` }} />
                      </span>
                    </div>
                    <span className="quests__points num">
                      {quest.quest_points_per_completion} <QuestSVG />
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
