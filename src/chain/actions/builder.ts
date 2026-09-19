import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

// Outpost Builder (game.mc)

const gameAction = (account: string, permission: string, name: string, data: Record<string, unknown> = {}): AnyAction => ({
  account: CONTRACTS.GAME,
  name,
  authorization: auth(account, permission),
  data: { wallet: account, ...data }
})

export const regPlayerAction = (account: string, permission: string) => gameAction(account, permission, 'regplayer')

export const upgradeBuildingAction = (account: string, permission: string, buildingid: string) =>
  gameAction(account, permission, 'upgbuilding', { buildingid })

export const exploderAction = (account: string, permission: string) => gameAction(account, permission, 'faucet')

/** Deliver Я at the Spaceport for MCP. */
export const deliverResourcesAction = (account: string, permission: string, amount: number) =>
  gameAction(account, permission, 'gctomcp', { gamecurrency: Math.floor(amount) })

/** Spend quest points for Я; aborts on chain if fewer than `expected` would arrive. */
export const qpToResourcesAction = (account: string, permission: string, qp: number, expected: number) =>
  gameAction(account, permission, 'qptogc', { qp, expected_resources: Math.floor(expected) })

export const qpFillStorageAction = (account: string, permission: string, qp: number) =>
  gameAction(account, permission, 'qptogcfill', { qp })

/** Stake NFTs into a building until the end of the season. */
export const stakeBuildingNftsAction = (
  account: string,
  permission: string,
  buildingid: string,
  assetIds: string[]
): AnyAction => ({
  account: CONTRACTS.ATOMICASSETS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.GAME, asset_ids: assetIds.map(Number), memo: `nftstake,${buildingid}` }
})
