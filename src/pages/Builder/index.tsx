import { Navigate, Route, Routes } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { useBuilderPlayer, useBuilderSeason } from '@/data/builder'
import { chainDate, useRerenderAt } from '@/lib/time'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import { Overview } from './Overview'
import { Welcome } from './Welcome'

import './Builder.css'

export default function Builder() {
  const account = useAccount()
  const season = useBuilderSeason()
  const player = useBuilderPlayer(account)
  const current = season.data
  const start = current ? +chainDate(current.season_start) : 0
  const end = current ? +chainDate(current.season_end) : 0
  const now = Date.now()
  // No clock here: the page only needs to switch views when the season starts or ends.
  useRerenderAt(now < start ? start : now < end ? end : undefined)
  const inSeason = !!current && now >= start && now < end

  return (
    <>
      <PageHeader title="Outpost Builder" image={publicUrl('/assets/background/bg-mcp-builder.webp')} />

      <div className="page builder plates">
        {season.isLoading || player.isLoading ? (
          <>
            <div className="skeleton builder-skel--top" />
            <div className="builder-columns">
              <div className="skeleton builder-skel--col" />
              <div className="skeleton builder-skel--col" />
            </div>
          </>
        ) : inSeason && current && player.data ? (
          <Routes>
            <Route index element={<Overview player={player.data} season={current} />} />
            <Route path="*" element={<Navigate to="/builder" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route index element={<Welcome season={current ?? null} />} />
            <Route path="*" element={<Navigate to="/builder" replace />} />
          </Routes>
        )}
      </div>
    </>
  )
}
