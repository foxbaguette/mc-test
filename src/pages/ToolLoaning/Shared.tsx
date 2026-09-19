import type { ReactNode } from 'react'

import { RARITY_COLORS } from '@/chain/config'
import { ClockIcon } from '@/icons/ui'
import { depositState } from '@/data/toolLoaning'
import type { ToolWallet } from '@/data/types/toolLoaning'
import PickaxeSVG from '@/icons/pickaxe'
import ShardsSVG from '@/icons/shards'
import { publicUrl } from '@/lib/publicUrl'

interface ToolCardProps {
  templateId: number | string
  name: string
  rarity: string
  shine?: string
  /** How many of this tool are available to the player. */
  owned?: number
  ready?: boolean
  stats?: ReactNode
  note?: ReactNode
  children?: ReactNode
}

/** Tool card: rarity-lit frame, readouts, then the one action it offers. */
export function ToolCard({ templateId, name, rarity, shine, owned, ready, stats, note, children }: ToolCardProps) {
  return (
    <article
      className={`tl-card ${ready ? 'is-ready' : ''}`}
      style={{ '--rarity': RARITY_COLORS[rarity] ?? 'var(--border-2)' } as React.CSSProperties}
    >
      <div className="tl-card__art nft-crop">
        <img
          src={publicUrl(`/assets/aw-nft-images/${templateId}.webp`)}
          alt={name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null
            e.currentTarget.src = publicUrl('/assets/default-card.png')
          }}
        />
        {owned !== undefined && owned > 1 && <span className="tl-card__count num">×{owned}</span>}
      </div>

      <div className="tl-card__body">
        <h3 className="tl-card__title" title={name}>
          {name}
        </h3>
        <p className="tl-card__sub">
          {rarity}
          {shine && ` · ${shine}`}
        </p>
        {stats}
        {note && <p className="tl-card__note">{note}</p>}
        <div className="tl-card__action">{children}</div>
      </div>
    </article>
  )
}

/** The three numbers that decide whether a tool is worth using. */
export function ToolStats({ power, nftPower, cooldown }: { power: number; nftPower: number; cooldown?: number }) {
  return (
    <div className="tl-stats">
      <span className="tl-stat" title="Mining power">
        <PickaxeSVG /> <span className="num">{power / 10}</span>
      </span>
      <span className="tl-stat" title="NFT power">
        <ShardsSVG /> <span className="num">{nftPower / 10}</span>
      </span>
      {cooldown !== undefined && (
        <span className="tl-stat" title="Cooldown">
          <ClockIcon /> <span className="num">{Math.round(cooldown / 60)}m</span>
        </span>
      )}
    </div>
  )
}

/** Deposited TLM, shown as a negative trial balance until real TLM is deposited. */
export function DepositValue({ wallet }: { wallet: ToolWallet | null | undefined }) {
  const state = depositState(wallet)
  return (
    <strong className={`num ${state.negative ? 'is-negative' : 'is-positive'}`}>
      {state.text} TLM{state.negative && <span className="loan-hint"> (Deposit more TLM)</span>}
    </strong>
  )
}
