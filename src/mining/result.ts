import { getTransaction } from '@/chain/history'
import { readMiner } from '@/data/tables'
import { sleep } from '@/lib/format'

interface LogMine {
  bounty?: string
  params?: { luck?: number }
}

const findLogMine = (actions: { act: { name: string; data: LogMine } }[]) =>
  actions.find((a) => a.act.name === 'logmine' && a.act.data?.bounty)?.act.data

/** Reads back what the last mine paid, for the "You mined …" message. */
export async function mineResultMessage(account: string): Promise<string> {
  // The history nodes need a few seconds to index the transaction.
  await sleep(6000)

  const miner = await readMiner(account).catch(() => null)
  if (!miner?.last_mine_tx) return 'Mine successful'

  // Mine buttons wait for this, so a slow node must not keep them spinning.
  const actions = await getTransaction<LogMine>(miner.last_mine_tx, (list) => !!findLogMine(list), 5000)
  const data = actions ? findLogMine(actions) : undefined
  if (!data?.bounty) return 'Mine successful'

  const shards = data.params?.luck ?? 0
  return shards > 0 ? `You mined ${data.bounty} & ${shards / 10} Shards` : `You mined ${data.bounty}`
}
