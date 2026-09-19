import { useMemo } from 'react'
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'

import { ArrowLeftCircleIcon, RefreshIcon } from '@/icons/ui'
import { PageHeader } from '@/components/PageHeader'
import {
  nextAdventureAt,
  refreshAdventures,
  useAdventures,
  useAdventureSettings,
  useAdvTemplates,
  useTemplateMap
} from '@/data/adventures'
import { chainDate, useNow } from '@/lib/time'
import { useAccount } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import { AvailableList } from './Available'
import { AdventureDetail } from './Detail'
import { ClaimableList, RunningList } from './Participations'

import './Adventures.css'

export default function Adventures() {
  const account = useAccount()
  const data = useAdventures(account)
  const templatesQuery = useAdvTemplates()
  const templates = useTemplateMap()
  const settings = useAdventureSettings()
  const now = useNow(15_000)
  const { pathname } = useLocation()

  const available = useMemo(
    () =>
      data.open.filter((a) => +chainDate(a.enter_end) > now).sort((a, b) => +chainDate(a.enter_end) - +chainDate(b.enter_end)),
    [data.open, now]
  )
  const running = useMemo(
    () =>
      data.participations
        .filter((p) => +chainDate(p.return_date) > now)
        .sort((a, b) => +chainDate(a.return_date) - +chainDate(b.return_date)),
    [data.participations, now]
  )
  const claimable = useMemo(() => data.participations.filter((p) => +chainDate(p.return_date) <= now), [data.participations, now])

  const isDetail = /^\/adventures\/\d+/.test(pathname)
  const tab = (to: string, label: string, count: number, end = false) => (
    <NavLink to={to} end={end} className={({ isActive }) => (isActive ? 'is-active' : '')}>
      {label}
      {!data.isLoading && <span className="adv-tabs__count num">{count}</span>}
    </NavLink>
  )

  return (
    <>
      <PageHeader title="Adventures" image={publicUrl('/assets/background/bg-adventures.webp')} />

      <div className="page adv">
        <div className="adv__bar">
          {isDetail ? (
            <Link to="/adventures" className="adv__back" aria-label="Back">
              <ArrowLeftCircleIcon size={30} />
            </Link>
          ) : (
            <span />
          )}
          <nav className="adv-tabs" aria-label="Adventures">
            {tab('/adventures', 'Available', available.length, true)}
            {tab('/adventures/running', 'Running', running.length)}
            {tab('/adventures/claimable', 'Claimable', claimable.length)}
          </nav>
          <button
            className={`icon-btn ${data.isFetching ? 'is-spinning' : ''}`}
            onClick={() => refreshAdventures(account)}
            disabled={data.isFetching}
            aria-label="Refresh"
          >
            <RefreshIcon />
          </button>
        </div>

        {data.isLoading || templatesQuery.isLoading ? (
          <div className="adv-list">
            <div className="skeleton adv-skel" />
            <div className="skeleton adv-skel" />
          </div>
        ) : (
          <Routes>
            <Route
              index
              element={
                <AvailableList
                  items={available}
                  now={now}
                  nextAt={nextAdventureAt(data.all, settings.data?.auto_create_hours, now)}
                />
              }
            />
            <Route path="running" element={<RunningList items={running} templates={templates} now={now} />} />
            <Route path="claimable" element={<ClaimableList items={claimable} templates={templates} />} />
            <Route path=":adventureId" element={<AdventureDetail available={available} templates={templates} now={now} />} />
            <Route path="*" element={<Navigate to="/adventures" replace />} />
          </Routes>
        )}
      </div>
    </>
  )
}
