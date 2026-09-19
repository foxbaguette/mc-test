import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth, tlm } from './shared'

import { payCpu, setBagAction, setLandAction, mineAction } from './mining'

// Tool Loaning (tools.mc)

/**
 * Mine with a loaned tool in one transaction, as the original site did:
 * pay CPU, move to the land, rent the tool(s), equip them, mine, hand the
 * tool(s) back to tools.mc and put the player's own bag back.
 */
export function loanMineActions(
  account: string,
  permission: string,
  { assetIds, landId, nonce, restoreBag }: { assetIds: string[]; landId: string; nonce: string; restoreBag: string[] }
): AnyAction[] {
  const ids = assetIds.map(Number)
  return [
    payCpu(account, permission, 2),
    setLandAction(account, permission, landId),
    {
      account: CONTRACTS.TOOLS,
      name: 'renttools',
      authorization: auth(account, permission),
      data: { wallet: account, tools: ids }
    },
    setBagAction(account, permission, assetIds),
    mineAction(account, permission, nonce),
    {
      account: CONTRACTS.ATOMICASSETS,
      name: 'transfer',
      authorization: auth(account, permission),
      data: { from: account, to: CONTRACTS.TOOLS, asset_ids: ids, memo: 'Returntool' }
    },
    setBagAction(account, permission, restoreBag)
  ]
}

export const stakeToolsAction = (account: string, permission: string, assetIds: string[]): AnyAction => ({
  account: CONTRACTS.ATOMICASSETS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.TOOLS, asset_ids: assetIds.map(Number), memo: 'staking' }
})

export const unstakeToolsAction = (account: string, permission: string, assetIds: string[]): AnyAction => ({
  account: CONTRACTS.TOOLS,
  name: 'unstake',
  authorization: auth(account, permission),
  data: { wallet: account, asset_ids: assetIds.map(Number) }
})

/** Withdraw TLM from the Tool Loaning deposit. */
export const claimToolsTlmAction = (account: string, permission: string, amount: number): AnyAction => ({
  account: CONTRACTS.TOOLS,
  name: 'claim',
  authorization: auth(account, permission),
  data: { wallet: account, tokens: tlm(amount) }
})

export const depositToolsTlmAction = (account: string, permission: string, amount: number): AnyAction => ({
  account: CONTRACTS.ALIEN_WORLDS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.TOOLS, quantity: tlm(amount), memo: 'deposit' }
})

/** Which tool templates the player allows for loaning. */
export const setTempListAction = (account: string, permission: string, templateIds: number[]): AnyAction => ({
  account: CONTRACTS.TOOLS,
  name: 'settemplist',
  authorization: auth(account, permission),
  data: { wallet: account, temp_ids: templateIds }
})
