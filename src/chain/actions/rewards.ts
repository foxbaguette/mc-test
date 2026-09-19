import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

// Rewards: land commission, DTAL, finished weeks (missions.mc) and the reward point vault.

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

/** Claim one finished week: with its TLM (claimweektlm), or with an MC Point boost of 0 (claimweek). */
export const claimWeekAction = (account: string, permission: string, weekId: number, withTlm = false): AnyAction => ({
  account: CONTRACTS.MISSIONS,
  name: withTlm ? 'claimweektlm' : 'claimweek',
  authorization: auth(account, permission),
  data: withTlm ? { wallet: account, week_id: weekId } : { wallet: account, week_id: weekId, boost_percentage: 0 }
})

/** Claim several finished weeks in one transaction, without an MC Point boost. */
export const claimWeeksActions = (account: string, permission: string, weekIds: number[]): AnyAction[] =>
  weekIds.map((weekId) => claimWeekAction(account, permission, weekId))

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
