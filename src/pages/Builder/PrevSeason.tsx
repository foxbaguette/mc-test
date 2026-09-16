import { useMemo, useState, type ReactNode } from 'react'

import { formatR, useBuilderRanking } from '@/data/builder'
import ShardsSVG from '@/icons/shards'
import StarSVG from '@/icons/star'

type Sort = 'score' | 'rate' | 'mcp' | 'shards'

export function PrevSeason() {
  const [sort, setSort] = useState<Sort>('score')
  const ranking = useBuilderRanking()

  const rows = useMemo(
    () =>
      [...(ranking.data ?? [])].sort((a, b) => {
        if (sort === 'rate') return b.gc_per_minute - a.gc_per_minute
        if (sort === 'mcp') return b.mcp_earned - a.mcp_earned
        if (sort === 'shards') return b.shards - a.shards
        return b.building_score - a.building_score || b.gc_per_minute - a.gc_per_minute
      }),
    [ranking.data, sort]
  )

  const header = (key: Sort, label: ReactNode) => (
    <th aria-sort={sort === key ? 'descending' : undefined}>
      <button className={`btable__sort ${sort === key ? 'is-active' : ''}`} onClick={() => setSort(key)}>
        {label}
      </button>
    </th>
  )

  return (
    <section className="panel">
      <div className="btable-scroll">
        <table className="btable btable--compact">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              {header('score', 'Building Score')}
              {header('rate', 'Я / min')}
              {header(
                'mcp',
                <>
                  Total <StarSVG />
                </>
              )}
              {header(
                'shards',
                <>
                  Shards <ShardsSVG color="#EBB309" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {ranking.isLoading
              ? Array.from({ length: 8 }, (_, i) => (
                  <tr key={i} className="btable__skeleton">
                    <td colSpan={6}>
                      <div className="skeleton" />
                    </td>
                  </tr>
                ))
              : rows.map((entry, i) => (
                  <tr key={entry.wallet}>
                    <td className="num">{i + 1}</td>
                    <td className="btable__name">{entry.gamertag}</td>
                    <td className="num">{formatR(entry.building_score)}</td>
                    <td className="num">{formatR(entry.gc_per_minute)}</td>
                    <td className="num">{formatR(entry.mcp_earned)}</td>
                    <td className="num">{formatR(entry.shards / 10)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
