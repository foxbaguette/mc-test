import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Avatar } from '@/components/Avatar'
import { NetworkStatus } from '@/components/NetworkStatus'
import { useLevels, useWeeks } from '@/data/game'
import { usePlayer } from '@/data/player'
import QuestSVG from '@/icons/quest'
import ShardsSVG from '@/icons/shards'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { formatAmount, formatCompact } from '@/lib/format'
import { useSession } from '@/state/session'
import { publicUrl } from '@/lib/publicUrl'

import { MineWidget } from './MineWidget'

import './Header.css'

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 2.6-6.3" />
      <path d="M3 4v4h4" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  )
}

function AccountMenu() {
  const navigate = useNavigate()
  const logout = useSession((s) => s.logout)
  const player = usePlayer()
  const levels = useLevels()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const level = player.member?.level ?? 1
  const experience = player.member?.experience ?? 0
  const needed = levels.data?.find((l) => l.level === level)?.xp_to_level_up ?? 100
  const progress = Math.min(100, (experience / needed) * 100)

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/')
  }

  return (
    <div className="account" ref={ref}>
      <button className="account__trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <span className="account__avatar">
          <Avatar avatar={player.member?.avatar} rarity={player.member?.avatarrarity} size={40} />
          <span className="account__level">{level}</span>
        </span>
        <span className="account__meta">
          <span className="account__name">{player.member?.playertag || player.account}</span>
          <span className="account__xp" role="progressbar" aria-valuenow={experience} aria-valuemax={needed} aria-label="XP">
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
      </button>

      {open && (
        <div className="account__menu" role="menu">
          <div className="account__summary">
            <span className="muted">{player.account}</span>
            <span className="num">
              {experience}/{needed} XP
            </span>
          </div>
          <div className="account__balances">
            <span className="chip" title="Reward Points">
              <QuestSVG /> {formatCompact(player.rewardPoints)}
            </span>
            <span className="chip" title="MC Points">
              <StarSVG /> {formatCompact(player.mcPoints)}
            </span>
            <span className="chip">
              <ShardsSVG color="#F6A800" /> {formatCompact(player.redeemablePoints)}
            </span>
            <span className="chip" title="TLM">
              <TLMSVG /> {formatCompact(player.tlm)}
            </span>
          </div>
          <div className="account__net">
            <NetworkStatus />
          </div>
          <button role="menuitem" onClick={() => navigate('/tlm-history')}>
            <HistoryIcon /> TLM History
          </button>
          <button role="menuitem" onClick={() => navigate('/user-settings')}>
            <GearIcon /> Settings
          </button>
          <button role="menuitem" className="account__logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}

export function Header() {
  const player = usePlayer()
  const { prizePool } = useWeeks()

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__start">
          <Link to="/menu" className="topbar__brand" aria-label="Mission Control">
            <img src={publicUrl('/assets/icons/mission-control.png')} alt="" />
            <img className="topbar__wordmark" src={publicUrl('/assets/icons/logo.webp')} alt="" />
          </Link>
        </div>

        <MineWidget />

        <div className="topbar__end">
          <div className="balances">
            <span className="chip" title="Reward Points">
              <QuestSVG /> {formatCompact(player.rewardPoints)}
            </span>
            <span className="chip" title="MC Points">
              <StarSVG /> {formatCompact(player.mcPoints)}
            </span>
            <span className="chip balances__optional">
              <ShardsSVG color="#F6A800" /> {formatCompact(player.redeemablePoints)}
            </span>
            <span className="chip" title="TLM">
              <TLMSVG /> {formatCompact(player.tlm)}
            </span>
          </div>

          <Link to="/week-reward" className="prize">
            <span className="prize__label">Prize Pool</span>
            <span className="prize__value num">
              {formatAmount(prizePool)} <TLMSVG />
            </span>
          </Link>

          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
