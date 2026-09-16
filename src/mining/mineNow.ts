import { toast } from '@/components/toast'
import { refreshMining } from '@/data/mining'
import { refreshPlayer } from '@/data/player'
import { readMiner } from '@/data/tables'
import type { EquippedTool } from '@/data/types/mining'
import { useSession } from '@/state/session'
import { canMine, formatTransactError, isUserCancel, MINING_BLOCKED_MESSAGE, transact } from '@/wallet/session'

import { mineActions } from './actions'
import { computeNonce } from './nonce'
import { mineResultMessage } from './result'

interface MineOptions {
  account: string
  permission: string
  tools: EquippedTool[] | undefined
  /** Switch to this land first; ignored when it is already the current land. */
  landId?: string
}

/** Proof of work, sign, broadcast, then report what the mine paid. Resolves true on success. */
export async function mineNow({ account, permission, tools, landId }: MineOptions): Promise<boolean> {
  // Before the proof of work: no point computing a nonce that may not be sent.
  if (!canMine(useSession.getState().wallet)) {
    toast.error(MINING_BLOCKED_MESSAGE)
    return false
  }
  try {
    const miner = await readMiner(account)
    const difficulty = (tools ?? []).reduce((sum, tool) => sum + Number(tool.pow ?? 0), 0)
    const nonce = await computeNonce({ account, lastMineTx: miner?.last_mine_tx, difficulty })
    const target = landId && landId !== miner?.current_land ? landId : undefined

    await transact(mineActions(account, permission, nonce, target))

    // Resolve only once the result is known and the cooldown data is fresh, so the mine
    // button stays busy until then instead of showing MINE again right after broadcasting.
    toast.success(await mineResultMessage(account))
    await Promise.all([refreshMining(account), refreshPlayer(account)])
    return true
  } catch (err) {
    if (!isUserCancel(err)) toast.error(formatTransactError(err))
    void refreshMining(account)
    return false
  }
}
