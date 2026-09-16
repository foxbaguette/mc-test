import { useCanMine } from '@/state/session'
import { MINING_BLOCKED_MESSAGE } from '@/wallet/session'

import './MiningBlocked.css'

/** Shown on mining screens to players whose wallet may not mine (Anchor). */
export function MiningBlocked() {
  const canMine = useCanMine()
  if (canMine) return null
  return (
    <p className="mining-blocked" role="status">
      {MINING_BLOCKED_MESSAGE}
    </p>
  )
}
