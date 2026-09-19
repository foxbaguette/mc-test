import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import './BalanceChip.css'

export type Balance = 'rewardPoints' | 'mcPoints' | 'shards' | 'tlm'

/** What each balance is, and how it comes and goes. */
const INFO: Record<Balance, { title: string; text: string }> = {
  rewardPoints: {
    title: 'Reward Points',
    text: 'Earned with Weekly Quests. When the week ends, the Prize Pool is split by everyone’s Reward Points and you claim your TLM on Weekly Rewards. Store them in the Trilium Vault to keep them for a later week.'
  },
  mcPoints: {
    title: 'MC Points',
    text: 'Mission Control’s points. You gain them each time you earn Shards in Alien Worlds as a member, plus from the Daily Claim, the Outpost Builder and referrals. Spend them on Adventures or to claim Weekly Rewards.'
  },
  shards: {
    title: 'Shards',
    text: 'Alien Worlds Shards, earned in Alien Legends, and also by mining, Zapp’s tasks, Planetary Defense and Builder seasons.'
  },
  tlm: {
    title: 'TLM',
    text: 'Trilium, the Alien Worlds token in your wallet. Earned in Alien Legends, and also by mining, Weekly Rewards and Planetary Defense.'
  }
}

const GAP = 8
const EDGE = 8

/**
 * A balance chip that explains itself: hover or focus it (tap on touch) and a small card says
 * what the balance is. The card sits in a portal, so menus and drawers never clip it.
 */
export function BalanceChip({ kind, className = '', children }: { kind: Balance; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null)
  const chipRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const id = useId()
  const info = INFO[kind]
  // Touch has no hover and not every phone focuses a tapped chip, so a tap toggles the card instead.
  const touch = useRef(false)

  // On touch, a tap anywhere else closes the card.
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!chipRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // Place the card under the chip, kept inside the screen; above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const chip = chipRef.current?.getBoundingClientRect()
      const tip = tipRef.current?.getBoundingClientRect()
      if (!chip || !tip) return
      const left = Math.min(Math.max(EDGE, chip.left + chip.width / 2 - tip.width / 2), window.innerWidth - tip.width - EDGE)
      const above = chip.bottom + GAP + tip.height > window.innerHeight - EDGE && chip.top - GAP - tip.height > EDGE
      setPos({ top: above ? chip.top - GAP - tip.height : chip.bottom + GAP, left, above })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  return (
    <>
      <span
        ref={chipRef}
        className={`chip balance-chip ${className}`}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => (touch.current = e.pointerType !== 'mouse')}
        onPointerDown={(e) => (touch.current = e.pointerType !== 'mouse')}
        onMouseEnter={() => !touch.current && setOpen(true)}
        onMouseLeave={() => !touch.current && setOpen(false)}
        onFocus={() => !touch.current && setOpen(true)}
        onBlur={() => !touch.current && setOpen(false)}
        onClick={() => touch.current && setOpen((v) => !v)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={`balance-tip ${pos?.above ? 'is-above' : ''}`}
            style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
          >
            <strong className="balance-tip__title">{info.title}</strong>
            <p className="balance-tip__text">{info.text}</p>
          </div>,
          document.body
        )}
    </>
  )
}
