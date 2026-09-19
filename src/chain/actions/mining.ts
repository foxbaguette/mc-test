import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

/*
 * Mining (m.federation), paid for through cpu.mc, and the favorite lands and tool sets
 * members.mc keeps for the mining screens.
 */

/** paycpu type: 0 = mine, 1 = change land and mine, 3 = daily reward (as used by the original site). */
export const payCpu = (account: string, permission: string, type: number): AnyAction => ({
  account: CONTRACTS.CPU,
  name: 'paycpu',
  authorization: auth(account, permission),
  data: { wallet: account, type }
})

export const mineAction = (account: string, permission: string, nonce: string): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'mine',
  authorization: auth(account, permission),
  data: { miner: account, nonce, notify: CONTRACTS.NOTIFY }
})

export const setLandAction = (account: string, permission: string, landId: string): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'setland',
  authorization: auth(account, permission),
  data: { account, land_id: landId }
})

export const setBagAction = (account: string, permission: string, items: string[]): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'setbag',
  authorization: auth(account, permission),
  data: { account, items: items.map(Number) }
})

export function mineActions(account: string, permission: string, nonce: string, landId?: string): AnyAction[] {
  if (!landId) return [payCpu(account, permission, 0), mineAction(account, permission, nonce)]
  return [payCpu(account, permission, 1), setLandAction(account, permission, landId), mineAction(account, permission, nonce)]
}

/** Claim Alien Worlds mining rewards (m.federation `minerclaim`). */
export const claimMinesAction = (account: string, permission: string): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'claimmines',
  authorization: auth(account, permission),
  data: { receiver: account }
})

const memberAction = (name: string, account: string, permission: string, data: Record<string, unknown>): AnyAction => ({
  account: CONTRACTS.MEMBERS,
  name,
  authorization: auth(account, permission),
  data: { wallet: account, ...data }
})

export const addFavLand = (account: string, permission: string, assetId: string) =>
  memberAction('addfavland', account, permission, { asset_id: assetId })
export const remFavLand = (account: string, permission: string, assetId: string) =>
  memberAction('remfavland', account, permission, { asset_id: assetId })
export const addFavTools = (account: string, permission: string, assetIds: string) =>
  memberAction('addfavtools', account, permission, { asset_ids: assetIds })
export const remFavTools = (account: string, permission: string, assetIds: string) =>
  memberAction('remfavtools', account, permission, { asset_ids: assetIds })
