import { Navigate, Route, Routes } from 'react-router-dom'

import { PageHeader } from '@/components/PageHeader'
import { useBuilderPlayer, useBuilderSeason } from '@/data/builder'
import { chainDate, useNow } from '@/lib/time'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import { Overview } from './Overview'
import { Welcome } from './Welcome'

import '../Questing.css'
import './Builder.css'

export default function Builder() {
  const account = useAccount()
  const season = useBuilderSeason()
  const player = useBuilderPlayer(account)
  // Resources tick up continuously, so the counter is read many times a second.
  const now = useNow(100)

  const current = season.data
  const inSeason = !!current && now >= +chainDate(current.season_start) && now < +chainDate(current.season_end)

  return (
    <>
      <PageHeader title="Outpost Builder" image={publicUrl('/assets/background/bg-mcp-builder.jpeg')} />

      <div className="page builder">
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
            <Route index element={<Overview player={player.data} season={current} now={now} />} />
            <Route path="*" element={<Navigate to="/builder" replace />} />
          </Routes>
        ) : (
          <Routes>
            <Route index element={<Welcome season={current ?? null} now={now} />} />
            <Route path="*" element={<Navigate to="/builder" replace />} />
          </Routes>
        )}
      </div>
    </>
  )
}
