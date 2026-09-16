import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

const auth = (account: string, permission: string) => [{ actor: account, permission }]

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

// ---------------------------------------------------------------------------
// Tool Loaning (tools.mc)
// ---------------------------------------------------------------------------

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
    { account: CONTRACTS.TOOLS, name: 'renttools', authorization: auth(account, permission), data: { wallet: account, tools: ids } },
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

const tlm = (amount: number) => `${amount.toFixed(4)} TLM`

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

/** Claim Alien Worlds mining rewards (m.federation `minerclaim`). */
export const claimMinesAction = (account: string, permission: string): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'claimmines',
  authorization: auth(account, permission),
  data: { receiver: account }
})

// ---------------------------------------------------------------------------
// The Vault (claims and reward point deposit)
// ---------------------------------------------------------------------------

/** Land commission earned when others mine the player's land. */
export const claimCommsAction = (account: string, permission: string): AnyAction => ({
  account: CONTRACTS.M_FEDERATION,
  name: 'claimcomms',
  authorization: auth(account, permission),
  data: { receiver: account }
})

/** DTAL: the daily payout for owning Alien Worlds land. */
export const claimPayoutAction = (account: string, permission: string): AnyAction => ({
  account: CONTRACTS.AWLNDRATINGS,
  name: 'claimpay',
  authorization: auth(account, permission),
  data: { receiver: account }
})

/** Claim several finished weeks in one transaction, without an MC Point boost. */
export const claimWeeksActions = (account: string, permission: string, weekIds: number[]): AnyAction[] =>
  weekIds.map((weekId) => ({
    account: CONTRACTS.MISSIONS,
    name: 'claimweek',
    authorization: auth(account, permission),
    data: { wallet: account, week_id: weekId, boost_percentage: 0 }
  }))

/** Park reward points in the vault (the contract keeps a 10% fee). */
export const storeRewardPointsAction = (account: string, permission: string, qp: number): AnyAction => ({
  account: CONTRACTS.MISSIONS,
  name: 'storeqp',
  authorization: auth(account, permission),
  data: { wallet: account, qp }
})

export const withdrawRewardPointsAction = (account: string, permission: string, qp: number): AnyAction => ({
  account: CONTRACTS.MISSIONS,
  name: 'withdrawqp',
  authorization: auth(account, permission),
  data: { wallet: account, qp }
})

// ---------------------------------------------------------------------------
// Voting (voting.mc)
// ---------------------------------------------------------------------------

/** Claim the vote power earned since the last claim, then cast it on up to two candidates. */
export function castVoteActions(
  account: string,
  permission: string,
  planet: string,
  candidates: string[],
  votes: number
): AnyAction[] {
  return [
    payCpu(account, permission, 4),
    {
      account: CONTRACTS.VOTING,
      name: 'claimpower',
      authorization: auth(account, permission),
      data: { wallet: account, claim_user_cpu: true }
    },
    {
      account: CONTRACTS.VOTING,
      name: 'castvote',
      authorization: auth(account, permission),
      data: { wallet: account, new_candidates: candidates, planet, votes }
    }
  ]
}

// ---------------------------------------------------------------------------
// Membership (members.mc)
// ---------------------------------------------------------------------------

/** Join Mission Control by paying the signup fee; the memo carries the referring wallet. */
export const signUpAction = (account: string, permission: string, cost: string, referrer?: string): AnyAction => ({
  account: CONTRACTS.ALIEN_WORLDS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: {
    from: account,
    to: CONTRACTS.MEMBERS,
    quantity: cost,
    memo: referrer ? 'signup,' + referrer : 'signup'
  }
})

// ---------------------------------------------------------------------------
// Support: member applications (members.mc)
// ---------------------------------------------------------------------------

const supportAction = (account: string, permission: string, name: string, data: Record<string, unknown>): AnyAction => ({
  account: CONTRACTS.MEMBERS,
  name,
  authorization: auth(account, permission),
  data: { wallet: account, ...data }
})

/** Promote a trial member to full membership. */
export const approveMemberAction = (account: string, permission: string, member: string) =>
  supportAction(account, permission, 'trialupg', { member })

/** Postpone a trial member's next review. */
export const delayMemberAction = (account: string, permission: string, member: string, days: number) =>
  supportAction(account, permission, 'trialdelay', { member, days })

export const flagMemberAction = (account: string, permission: string, member: string, reason: string) =>
  supportAction(account, permission, 'memberflag', { member, reason })

// ---------------------------------------------------------------------------
// Zapp's (emporium.mc)
// ---------------------------------------------------------------------------

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
      data: { from: account, to: CONTRACTS.EMPORIUM, quantity: `${price.toFixed(4)} TLM`, memo: `complete task,${task.task_id}` }
    }
  }
  return {
    account: CONTRACTS.EMPORIUM,
    name: 'finishtask',
    authorization: auth(account, permission),
    data: { wallet: account, task_id: task.task_id, currency_amount: price }
  }
}

// ---------------------------------------------------------------------------
// Adventures (adventure.mc)
// ---------------------------------------------------------------------------

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
export const startAdventureWithNftsAction = (account: string, permission: string, adventureid: number, assetIds: string[]): AnyAction => ({
  account: CONTRACTS.ATOMICASSETS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.ADVENTURE, asset_ids: assetIds.map(Number), memo: `mcadventure,${adventureid}` }
})

// ---------------------------------------------------------------------------
// Outpost Builder (game.mc)
// ---------------------------------------------------------------------------

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
export const stakeBuildingNftsAction = (account: string, permission: string, buildingid: string, assetIds: string[]): AnyAction => ({
  account: CONTRACTS.ATOMICASSETS,
  name: 'transfer',
  authorization: auth(account, permission),
  data: { from: account, to: CONTRACTS.GAME, asset_ids: assetIds.map(Number), memo: `nftstake,${buildingid}` }
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
