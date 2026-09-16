import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { SECONDARY_GROUPS, useNavItems, type NavItem } from './nav'

import './SectionNav.css'

/** One entry of the bar or of the More menu. */
function NavEntry({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const content = (
    <>
      {item.icon}
      <span className="section-nav__label">{item.title}</span>
    </>
  )

  if (item.external) {
    return (
      <a className="section-nav__item" href={item.path} target="_blank" rel="noreferrer" title={item.title} onClick={onNavigate}>
        {content}
      </a>
    )
  }
  if (item.disabled) {
    return (
      <span className="section-nav__item is-disabled" aria-disabled="true" title={item.title}>
        {content}
      </span>
    )
  }
  return (
    <NavLink
      to={`/${item.path}`}
      title={item.title}
      onClick={onNavigate}
      className={({ isActive }) => `section-nav__item ${isActive ? 'is-active' : ''}`}
    >
      {content}
    </NavLink>
  )
}

/** The sections used most days stay on the bar; the rest live behind More (see SectionNav.css). */
export function SectionNav() {
  const items = useNavItems()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const secondary = SECONDARY_GROUPS.map((group) => items[group])
  const inMore = secondary.flat().some((item) => !item.external && pathname === `/${item.path}`)

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav className="section-nav" aria-label="Sections">
      <div className="section-nav__inner">
        {items.main.map((item) => (
          <NavEntry key={item.title} item={item} />
        ))}

        <span className="section-nav__divider" aria-hidden />

        <div className="section-nav__more" ref={moreRef}>
          <button
            type="button"
            className={`section-nav__item section-nav__more-btn ${open ? 'is-open' : ''} ${inMore ? 'is-active' : ''}`}
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="true"
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
            <span className="section-nav__label">More</span>
          </button>

          {open && (
            <div className="section-nav__panel">
              {secondary.map((group, index) => (
                <div key={index} className="section-nav__panel-group">
                  {index > 0 && <span className="section-nav__panel-divider" aria-hidden />}
                  {group.map((item) => (
                    <NavEntry key={item.title} item={item} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
