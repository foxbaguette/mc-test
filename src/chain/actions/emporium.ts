import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth, tlm } from './shared'

// Zapp's (emporium.mc)

/** Finish one of Zapp's tasks: TLM tasks are paid by transfer, MC Point and quest point tasks through finishtask. */
export function finishTaskAction(
  account: string,
  permission: string,
  task: { task_id: number; task_type: string },
  price: number
): AnyAction {
  if (task.task_type === 'tlm') {
    return {
      account: CONTRACTS.ALIEN_WORLDS,
      name: 'transfer',
      authorization: auth(account, permission),
      data: { from: account, to: CONTRACTS.EMPORIUM, quantity: tlm(price), memo: `complete task,${task.task_id}` }
    }
  }
  return {
    account: CONTRACTS.EMPORIUM,
    name: 'finishtask',
    authorization: auth(account, permission),
    data: { wallet: account, task_id: task.task_id, currency_amount: price }
  }
}
