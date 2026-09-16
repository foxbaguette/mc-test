import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
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

/** Layout route for the signed-in app: waits for the restored session, sends visitors to the landing page. */
function PrivateLayout() {
  const { account, restored } = useSession(useShallow((s) => ({ account: s.account, restored: s.restored })))
  const location = useLocation()
  if (!restored) return <Loading />
  if (!account) return <Navigate to={`/?redirect=${encodeURIComponent(location.pathname.slice(1))}`} replace />
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  )
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
            {/* Every page behind sign-in shares the session check and the app layout. */}
            <Route element={<PrivateLayout />}>
              <Route path="/menu" element={<Menu />} />
              <Route path="/questing" element={<Questing />} />
              <Route path="/week-reward" element={<WeekReward />} />
              <Route path="/daily-rewards" element={<DailyRewards />} />
              <Route path="/aw-mining" element={<AwMining />} />
              <Route path="/tlm-history" element={<TlmHistory />} />
              <Route path="/user-settings" element={<UserSettings />} />
              <Route path="/treasure-hunt" element={<TreasureHuntPage />} />
              <Route path="/tool-loaning" element={<ToolLoaning />} />
              <Route path="/builder/*" element={<Builder />} />
              <Route path="/adventures/*" element={<Adventures />} />
              <Route path="/mine-max" element={<MineMax />} />
              <Route path="/emporium/*" element={<Emporium />} />
              <Route path="/applications" element={<Applications />} />
              <Route path="/voting" element={<Voting />} />
              <Route path="/trilium-vault" element={<TriliumVault />} />
              <Route path="/tool-tactician" element={<ToolTactician />} />
              <Route path="/membership" element={<Membership />} />
              <Route path="/news" element={<News />} />
            </Route>
            <Route path="/mine-history" element={<Navigate to="/tlm-history" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
