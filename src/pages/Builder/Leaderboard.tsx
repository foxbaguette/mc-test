import { useMemo, useState, type ReactNode } from 'react'

import { formatR, shardColor, type LeaderboardSort, useBuilderLeaderboard } from '@/data/builder'
import type { BuilderPlayer } from '@/data/types/builder'
import ShardsSVG from '@/icons/shards'

import { BuilderDialog, BuildingIcons } from './shared'

export function LeaderboardDialog({ player, onClose }: { player: BuilderPlayer; onClose: () => void }) {
  const [sort, setSort] = useState<LeaderboardSort>('score')
  const board = useBuilderLeaderboard(sort)

  const rows = useMemo(() => {
    const list = [...(board.data ?? [])]
    if (sort === 'score') {
      list.sort((a, b) => b.score_building - a.score_building || b.gamecurrency_per_minute - a.gamecurrency_per_minute)
    }
    return list
  }, [board.data, sort])

  const myRank = rows.findIndex((row) => row.wallet === player.wallet) + 1

  const header = (key: LeaderboardSort, label: ReactNode) => (
    <th aria-sort={sort === key ? 'descending' : undefined}>
      <button className={`btable__sort ${sort === key ? 'is-active' : ''}`} onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  )

  const row = (entry: BuilderPlayer, rank: ReactNode, shard: number | null, className = '') => (
    <tr key={`${className}${entry.wallet}`} className={className}>
      <td>
        <span className="btable__rank num">
          {rank} {shard !== null && <ShardsSVG color={shardColor(shard)} />}
        </span>
      </td>
      <td className="btable__name">{entry.gamertag}</td>
      <td className="num">{formatR(entry.score_building)}</td>
      <td className="num">{formatR(entry.gamecurrency_per_minute)}</td>
      <td className="num">{formatR(entry.score_mcp)}</td>
      <td>
        <BuildingIcons buildings={entry.buildings} />
      </td>
    </tr>
  )

  return (
    <BuilderDialog className="bdlg--board" title="SEASON LEADERBOARD" onClose={onClose}>
      <div className="btable-scroll">
        <table className="btable">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Gamertag</th>
              {header('score', 'Score🏆')}
              {header('rate', 'Я / min')}
              {header('mcp', 'MCP earned')}
              <th>Buildings</th>
            </tr>
          </thead>
          <tbody>
            {row(player, board.isLoading ? '-' : myRank === 0 ? '> 100' : myRank, myRank > 0 ? myRank - 1 : null, 'is-me ')}
            {board.isLoading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="btable__skeleton">
                    <td colSpan={6}>
                      <div className="skeleton" />
                    </td>
                  </tr>
                ))
              : rows.map((entry, i) => row(entry, i + 1, sort === 'score' ? i : null))}
          </tbody>
        </table>
      </div>
    </BuilderDialog>
  )
}
