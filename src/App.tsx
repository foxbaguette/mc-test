import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Loading } from '@/components/Loading'
import { Toaster } from '@/components/Toaster'
import { useSession } from '@/state/session'

const Landing = lazy(() => import('@/pages/Landing'))
const Menu = lazy(() => import('@/pages/Menu'))
const Questing = lazy(() => import('@/pages/Questing'))
const WeekReward = lazy(() => import('@/pages/WeekReward'))
const DailyRewards = lazy(() => import('@/pages/DailyRewards'))
const AwMining = lazy(() => import('@/pages/AwMining'))
const TlmHistory = lazy(() => import('@/pages/TlmHistory'))
const UserSettings = lazy(() => import('@/pages/UserSettings'))
const TreasureHuntPage = lazy(() => import('@/pages/TreasureHunt'))
const ToolLoaning = lazy(() => import('@/pages/ToolLoaning'))
const Builder = lazy(() => import('@/pages/Builder'))
const Adventures = lazy(() => import('@/pages/Adventures'))
const MineMax = lazy(() => import('@/pages/MineMax'))
const Emporium = lazy(() => import('@/pages/Emporium'))
const Applications = lazy(() => import('@/pages/Applications'))
const Voting = lazy(() => import('@/pages/Voting'))
const TriliumVault = lazy(() => import('@/pages/TriliumVault'))
const ToolTactician = lazy(() => import('@/pages/ToolTactician'))
const Membership = lazy(() => import('@/pages/Membership'))
const News = lazy(() => import('@/pages/News'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function PublicOnly({ children }: { children: ReactNode }) {
  const { account, restored } = useSession(useShallow((s) => ({ account: s.account, restored: s.restored })))
  const location = useLocation()
  if (restored && account) {
    const redirect = new URLSearchParams(location.search).get('redirect')
    return <Navigate to={`/${redirect ?? 'menu'}`} replace />
  }
  return <>{children}</>
}

function Private({ children }: { children: ReactNode }) {
  const { account, restored } = useSession(useShallow((s) => ({ account: s.account, restored: s.restored })))
  const location = useLocation()
  if (!restored) return <Loading />
  if (!account) return <Navigate to={`/?redirect=${encodeURIComponent(location.pathname.slice(1))}`} replace />
  return <AuthLayout>{children}</AuthLayout>
}

export function App() {
  return (
    <>
      <Toaster />
      {/* Outer net for the landing page and anything outside the app layout. */}
      <ErrorBoundary>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route
              path="/"
              element={
                <PublicOnly>
                  <Landing />
                </PublicOnly>
              }
            />
            <Route
              path="/menu"
              element={
                <Private>
                  <Menu />
                </Private>
              }
            />
            <Route
              path="/questing"
              element={
                <Private>
                  <Questing />
                </Private>
              }
            />
            <Route
              path="/week-reward"
              element={
                <Private>
                  <WeekReward />
                </Private>
              }
            />
            <Route
              path="/daily-rewards"
              element={
                <Private>
                  <DailyRewards />
                </Private>
              }
            />
            <Route
              path="/aw-mining"
              element={
                <Private>
                  <AwMining />
                </Private>
              }
            />
            <Route
              path="/tlm-history"
              element={
                <Private>
                  <TlmHistory />
                </Private>
              }
            />
            <Route path="/mine-history" element={<Navigate to="/tlm-history" replace />} />
            <Route
              path="/user-settings"
              element={
                <Private>
                  <UserSettings />
                </Private>
              }
            />
            <Route
              path="/treasure-hunt"
              element={
                <Private>
                  <TreasureHuntPage />
                </Private>
              }
            />
            <Route
              path="/tool-loaning"
              element={
                <Private>
                  <ToolLoaning />
                </Private>
              }
            />
            <Route
              path="/builder/*"
              element={
                <Private>
                  <Builder />
                </Private>
              }
            />
            <Route
              path="/adventures/*"
              element={
                <Private>
                  <Adventures />
                </Private>
              }
            />
            <Route
              path="/mine-max"
              element={
                <Private>
                  <MineMax />
                </Private>
              }
            />
            <Route
              path="/emporium/*"
              element={
                <Private>
                  <Emporium />
                </Private>
              }
            />
            <Route
              path="/applications"
              element={
                <Private>
                  <Applications />
                </Private>
              }
            />
            <Route
              path="/voting"
              element={
                <Private>
                  <Voting />
                </Private>
              }
            />
            <Route
              path="/trilium-vault"
              element={
                <Private>
                  <TriliumVault />
                </Private>
              }
            />
            <Route
              path="/tool-tactician"
              element={
                <Private>
                  <ToolTactician />
                </Private>
              }
            />
            <Route
              path="/membership"
              element={
                <Private>
                  <Membership />
                </Private>
              }
            />
            <Route
              path="/news"
              element={
                <Private>
                  <News />
                </Private>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
