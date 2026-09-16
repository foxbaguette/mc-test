import { toast } from '@/components/Toaster'
import { refreshMining, refreshPlayer } from '@/data/queries'
import { readMiner, readToolOvRow } from '@/data/tables'
import { KOL_DIGGER, KOL_DIGGER_LAND, refreshToolLoaning, type LoanTool } from '@/data/toolLoaning'
import { formatTransactError, isUserCancel, transact } from '@/wallet/session'

import { loanMineActions } from './actions'
import { computeNonce } from './nonce'
import { mineResultMessage } from './result'

interface LoanMineOptions {
  account: string
  permission: string
  tool: LoanTool
  /** Asset ids of the player's own bag, restored after the loan. */
  bagIds: string[]
  /** Best land for this tool; the Certified Kol Digger always uses its own land. */
  landId?: string
}

/** Rents a loaned tool, mines with it and returns it. Resolves true on success. */
export async function mineWithLoanedTool({ account, permission, tool, bagIds, landId }: LoanMineOptions): Promise<boolean> {
  try {
    let assetIds: string[]
    let difficulty: number
    let land: string | undefined

    if (tool.tool_name === KOL_DIGGER) {
      if (!tool.mtool) throw new Error('This tool was used recently. Please use another or wait until the cooldown expires')
      assetIds = tool.mtool.asset_ids
      difficulty = assetIds.length * tool.pow
      land = KOL_DIGGER_LAND
    } else {
      // Always ask the chain which copy is next in line; the cached list can be a mine behind.
      const row = await readToolOvRow(tool.template_id)
      if (!row?.next_asset_id) throw new Error('This tool was used recently. Please use another or wait until the cooldown expires')
      assetIds = [String(row.next_asset_id)]
      difficulty = row.pow
      land = landId
    }
    if (!land) throw new Error('Mines not found')

    const miner = await readMiner(account)
    const nonce = await computeNonce({ account, lastMineTx: miner?.last_mine_tx, difficulty })

    await transact(loanMineActions(account, permission, { assetIds, landId: land, nonce, restoreBag: bagIds }))

    // Stay busy until the result is known and the tool cooldowns are fresh (see mineNow).
    toast.success(await mineResultMessage(account))
    await Promise.all([refreshMining(account), refreshPlayer(account), refreshToolLoaning(account)])
    return true
  } catch (err) {
    if (!isUserCancel(err)) toast.error(formatTransactError(err))
    void refreshToolLoaning(account)
    return false
  }
}
