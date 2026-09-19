import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

// Adventures (adventure.mc)

const adventureAction = (account: string, permission: string, name: string, adventureid: number): AnyAction => ({
  account: CONTRACTS.ADVENTURE,
  name,
  authorization: auth(account, permission),
  data: { wallet: account, adventureid }
})

/** Join without NFTs. */
export const joinAdventureAction = (account: string, permission: string, adventureid: number) =>
  adventureAction(account, permission, 'joinadv', adventureid)

export const claimAdventureAction = (account: string, permission: string, adventureid: number) =>
  adventureAction(account, permission, 'claimadv', adventureid)

/** Join by sending the team's NFTs; they come back when the adventure is claimed. */
export const startAdventureWithNftsAction = (
  account: string,
  permission: string,
  adventureid: number,
  assetIds: string[]
): AnyAction => ({
  account: CONTRACTS.ATOMICASSETS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.ADVENTURE, asset_ids: assetIds.map(Number), memo: `mcadventure,${adventureid}` }
})
