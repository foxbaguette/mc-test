import { NavLink } from 'react-router-dom'

import { NAV_GROUPS, TABBAR_ORDER, useNavItems } from './nav'

import './TabBar.css'

/** Phone navigation: the four most-used sections, plus More for the full menu sheet. */
export function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const items = useNavItems()
  const primary = NAV_GROUPS.flatMap((g) => items[g])
    .filter((item) => item.primary)
    .sort((a, b) => TABBAR_ORDER.indexOf(a.path) - TABBAR_ORDER.indexOf(b.path))

  return (
    <nav className="tabbar" aria-label="Main sections">
      {primary.map((item) =>
        item.disabled ? (
          <span key={item.path} className="tab is-disabled" aria-disabled="true">
            {item.icon}
            <span>{item.title}</span>
          </span>
        ) : (
          <NavLink key={item.path} to={`/${item.path}`} className={({ isActive }) => `tab ${isActive ? 'is-active' : ''}`}>
            {item.icon}
            <span>{item.title}</span>
          </NavLink>
        )
      )}

      <button
        type="button"
        className={`tab ${moreOpen ? 'is-active' : ''}`}
        onClick={onMore}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
        <span>More</span>
      </button>
    </nav>
  )
}
