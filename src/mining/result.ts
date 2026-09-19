import { getTransaction, type HistoryAction } from '@/chain/history'
import { sleep } from '@/lib/format'

interface LogMine {
  bounty?: string
  params?: { luck?: number }
}

/**
 * History nodes index a mine within about two seconds. Ask soon, then back off: in all about
 * 10 s of waiting plus at most 2.5 s per lookup, so a slow node can't keep the mine button busy.
 */
const POLL_DELAYS_MS = [1500, 1500, 2500, 4000]
const LOOKUP_TIMEOUT_MS = 2500

const findLogMine = (actions: HistoryAction<LogMine>[]) =>
  actions.find((a) => a.act.name === 'logmine' && a.act.data?.bounty)?.act.data

/** Reads back what this mine transaction paid, for the "You mined …" message. */
export async function mineResultMessage(txId: string): Promise<string> {
  if (!txId) return 'Mine successful'

  for (const delay of POLL_DELAYS_MS) {
    await sleep(delay)
    const actions = await getTransaction<LogMine>(txId, (list) => !!findLogMine(list), LOOKUP_TIMEOUT_MS)
    const data = actions ? findLogMine(actions) : undefined
    if (data?.bounty) {
      const shards = data.params?.luck ?? 0
      return shards > 0 ? `You mined ${data.bounty} & ${shards / 10} Shards` : `You mined ${data.bounty}`
    }
  }
  return 'Mine successful'
}
