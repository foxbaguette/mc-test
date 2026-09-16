import { useEffect, useRef, type ReactNode } from 'react'

import { buildingImage, splitBuildings } from '@/data/builder'
import type { PlayerBuilding } from '@/data/types'
import { publicUrl } from '@/lib/publicUrl'

export function NftImg({ templateId, alt = '' }: { templateId: string | number; alt?: string }) {
  return (
    <img
      src={publicUrl(`/assets/aw-nft-images/${templateId}.webp`)}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null
        e.currentTarget.src = publicUrl('/assets/default-card.png')
      }}
    />
  )
}

interface DialogProps {
  title: string
  className?: string
  onClose: () => void
  children: ReactNode
}

/** Everything the outpost opens stays on the overview, in a console panel over it. */
export function BuilderDialog({ title, className = '', onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => ref.current?.showModal(), [])

  return (
    <dialog
      ref={ref}
      className={`bmodal ${className}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="bmodal__body">
        <header className="bmodal__head">
          <h2 className="bmodal__title">{title}</h2>
          <button className="icon-btn bmodal__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="bmodal__content">{children}</div>
      </div>
    </dialog>
  )
}

/** Shard colour for a leaderboard position (0-based), as on the original leaderboard. */
export function shardColor(index: number) {
  if (index < 3) return '#e80066'
  if (index < 10) return '#e69839'
  if (index < 25) return '#9716ec'
  if (index < 50) return '#2a74e6'
  return '#9d9d9d'
}

/** Small building icons with their levels, for the leaderboard. */
export function BuildingIcons({ buildings }: { buildings: PlayerBuilding[] }) {
  const { production, special } = splitBuildings(buildings)
  const icon = (b: PlayerBuilding) => (
    <span key={b.buildingid} className="btable__build" title={b.building_name}>
      <img src={buildingImage(b.buildingid)} alt="" loading="lazy" />
      <span className="num">{b.building_level === 0 ? '-' : b.building_level}</span>
    </span>
  )
  return (
    <span className="btable__builds">
      {production.map(icon)}
      <span className="btable__gap" aria-hidden />
      {special.map(icon)}
    </span>
  )
}
