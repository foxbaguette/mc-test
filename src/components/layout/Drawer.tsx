import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { Avatar } from '@/components/Avatar'
import { BalanceChip } from '@/components/BalanceChip'
import { NetworkStatus } from '@/components/NetworkStatus'
import { useDismiss } from '@/components/useDismiss'
import { usePlayer } from '@/data/player'
import { useWeeks } from '@/data/game'
import QuestSVG from '@/icons/quest'
import ShardsSVG from '@/icons/shards'
import StarSVG from '@/icons/star'
import TLMSVG from '@/icons/tlm'
import { formatAmount } from '@/lib/format'
import { useSession } from '@/state/session'
import { CloseIcon } from '@/icons/ui'

import { NavTile } from './MenuNav'
import { NAV_GROUPS, useNavItems } from './nav'

import './Drawer.css'

/** Mobile navigation: profile summary, balances and every section in one sheet. */
export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)
  const logout = useSession((s) => s.logout)
  const player = usePlayer()
  const { prizePool } = useWeeks()
  const items = useNavItems()

  // A press on the backdrop is outside the panel, so it closes the sheet like Escape does.
  useDismiss(open, panelRef, onClose)

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  async function handleLogout() {
    onClose()
    await logout()
    navigate('/')
  }

  return (
    <div className={`drawer ${open ? 'is-open' : ''}`} aria-hidden={!open}>
      <div className="drawer__backdrop" />
      <div className="drawer__panel" ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="drawer__head">
          <Avatar avatar={player.member?.avatar} rarity={player.member?.avatarrarity} size={48} />
          <div className="drawer__who">
            <strong>{player.member?.playertag || player.account}</strong>
            <span className="muted">{player.account}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="drawer__balances">
          <BalanceChip kind="rewardPoints">
            <QuestSVG /> {player.rewardPoints.toLocaleString('en-US')}
          </BalanceChip>
          <BalanceChip kind="mcPoints">
            <StarSVG /> {player.mcPoints.toLocaleString('en-US')}
          </BalanceChip>
          <BalanceChip kind="shards">
            <ShardsSVG color="#F6A800" /> {formatAmount(player.redeemablePoints, 1)}
          </BalanceChip>
          <BalanceChip kind="tlm">
            <TLMSVG /> {formatAmount(player.tlm, 2)}
          </BalanceChip>
        </div>

        <button className="drawer__prize" onClick={() => navigate('/week-reward')}>
          <span>Prize Pool</span>
          <strong className="num">
            {formatAmount(prizePool)} <TLMSVG />
          </strong>
        </button>

        {NAV_GROUPS.map((group) => (
          <section key={group} className="drawer__group">
            <div className="drawer__grid">
              {items[group].map((item) => (
                <NavTile key={item.title} item={item} onNavigate={onClose} />
              ))}
            </div>
          </section>
        ))}

        <div className="drawer__foot">
          <NetworkStatus />
          <button className="drawer__logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
