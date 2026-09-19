import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Avatar } from '@/components/Avatar'
import { BalanceChip } from '@/components/BalanceChip'
import { NetworkStatus } from '@/components/NetworkStatus'
import { useDismiss } from '@/components/useDismiss'
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
import { GearIcon, HistoryIcon } from '@/icons/ui'

import './Header.css'

/** A balance that failed to load shows a dash rather than a misleading zero. */
const balance = (value: number, failed: boolean) => (failed ? '—' : formatCompact(value))

function AccountMenu() {
  const navigate = useNavigate()
  const logout = useSession((s) => s.logout)
  const player = usePlayer()
  const levels = useLevels()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(open, ref, () => setOpen(false))

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
            <BalanceChip kind="rewardPoints">
              <QuestSVG /> {balance(player.rewardPoints, player.failed.rewardPoints)}
            </BalanceChip>
            <BalanceChip kind="mcPoints">
              <StarSVG /> {balance(player.mcPoints, player.failed.mcPoints)}
            </BalanceChip>
            <BalanceChip kind="shards">
              <ShardsSVG color="#F6A800" /> {balance(player.redeemablePoints, player.failed.redeemablePoints)}
            </BalanceChip>
            <BalanceChip kind="tlm">
              <TLMSVG /> {balance(player.tlm, player.failed.tlm)}
            </BalanceChip>
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
            <BalanceChip kind="rewardPoints">
              <QuestSVG /> {balance(player.rewardPoints, player.failed.rewardPoints)}
            </BalanceChip>
            <BalanceChip kind="mcPoints">
              <StarSVG /> {balance(player.mcPoints, player.failed.mcPoints)}
            </BalanceChip>
            <BalanceChip kind="shards" className="balances__optional">
              <ShardsSVG color="#F6A800" /> {balance(player.redeemablePoints, player.failed.redeemablePoints)}
            </BalanceChip>
            <BalanceChip kind="tlm">
              <TLMSVG /> {balance(player.tlm, player.failed.tlm)}
            </BalanceChip>
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
