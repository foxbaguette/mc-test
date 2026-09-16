import { HISTORY_NODES } from '@/chain/config'
import { readMiner } from '@/data/tables'
import { sleep } from '@/lib/format'

interface HistoryAction {
  act: { name: string; data?: { bounty?: string; params?: { luck?: number } } }
}

/** Reads back what the last mine paid, for the "You mined …" message. */
export async function mineResultMessage(account: string): Promise<string> {
  // The history nodes need a few seconds to index the transaction.
  await sleep(6000)

  const miner = await readMiner(account).catch(() => null)
  if (!miner?.last_mine_tx) return 'Mine successful'

  for (const node of HISTORY_NODES) {
    try {
      // Mine buttons wait for this, so a slow node must not keep them spinning.
      const res = await fetch(`${node}/v2/history/get_transaction?id=${miner.last_mine_tx}`, {
        signal: AbortSignal.timeout(5000)
      })
      if (!res.ok) continue
      const json: { actions?: HistoryAction[] } = await res.json()
      const data = json.actions?.find((a) => a.act.name === 'logmine' && a.act.data?.bounty)?.act.data
      if (!data?.bounty) continue
      const shards = data.params?.luck ?? 0
      return shards > 0 ? `You mined ${data.bounty} & ${shards / 10} Shards` : `You mined ${data.bounty}`
    } catch {
      /* try the next history node */
    }
  }
  return 'Mine successful'
}
