import { RARITY_COLORS } from '@/chain/config'
import { IpfsImg } from './IpfsImg'

import './Avatar.css'

interface AvatarProps {
  /** "<ipfs hash>;<collection>" as stored on chain. */
  avatar?: string | null
  rarity?: string
  size?: number
  shape?: 'round' | 'drop'
  className?: string
}

/** Member avatar; full-body alienavatars renders are cropped to the head. */
export function Avatar({ avatar, rarity, size = 50, shape = 'round', className = '' }: AvatarProps) {
  const [hash, collection] = String(avatar ?? '').split(';')
  const isAlien = (collection ?? '').trim() === 'alienavatars'

  return (
    <span
      className={`avatar avatar--${shape} ${isAlien ? 'avatar--alien' : ''} ${className}`}
      style={{ width: size, height: size, borderColor: rarity ? RARITY_COLORS[rarity] : undefined }}
    >
      <IpfsImg hash={hash} alt="" />
    </span>
  )
}
