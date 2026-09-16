import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { ErrorBoundary } from '@/components/ErrorBoundary'

import { Drawer } from './Drawer'
import { Header } from './Header'
import { SectionNav } from './SectionNav'
import { TabBar } from './TabBar'

import './AuthLayout.css'

export function AuthLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const path = pathname.slice(1)
  const [sheetOpen, setSheetOpen] = useState(false)

  // New page: close the menu sheet and start at the top.
  useEffect(() => {
    setSheetOpen(false)
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className={`app app--${path}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <SectionNav />
      <main id="main" className="app__main">
        {/* Keyed by page: a crash stays on its page and clears when the player navigates away. */}
        <ErrorBoundary key={pathname}>
          <Suspense
            fallback={
              <div className="app__loading">
                <span className="spinner spinner--lg" />
              </div>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
      <TabBar onMore={() => setSheetOpen(true)} moreOpen={sheetOpen} />
      <Drawer open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
