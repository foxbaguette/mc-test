import { Link } from 'react-router-dom'

import type { NavItem } from './nav'

import './MenuNav.css'

/** Section tile, used by the mobile drawer. */
export function NavTile({ item, className = '', onNavigate }: { item: NavItem; className?: string; onNavigate?: () => void }) {
  const content = (
    <>
      <span className="nav-tile__icon">{item.icon}</span>
      <span className="nav-tile__label">{item.title}</span>
    </>
  )
  const classes = `nav-tile ${item.disabled ? 'is-disabled' : ''} ${className}`

  if (item.external) {
    return (
      <a className={classes} href={item.path} target="_blank" rel="noreferrer" onClick={onNavigate}>
        {content}
      </a>
    )
  }
  if (item.disabled) {
    return (
      <span className={classes} aria-disabled="true">
        {content}
      </span>
    )
  }
  return (
    <Link className={classes} to={`/${item.path}`} onClick={onNavigate}>
      {content}
    </Link>
  )
}
