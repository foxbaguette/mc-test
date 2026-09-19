import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

import { payCpu } from './mining'

// Membership, the daily claim, player settings and support work (members.mc).

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

/** The daily wheel spin; cpu.mc type 3. */
export const dailyRewardActions = (account: string, permission: string): AnyAction[] => [
  payCpu(account, permission, 3),
  { account: CONTRACTS.MEMBERS, name: 'dailyrewards', authorization: auth(account, permission), data: { wallet: account } }
]

/** Player tag (federation) and whether Mission Control may pay the player's CPU (members.mc). */
export const saveSettingsActions = (account: string, permission: string, tag: string, freeCpu: boolean): AnyAction[] => [
  { account: CONTRACTS.FEDERATION, name: 'settag', authorization: auth(account, permission), data: { account, tag } },
  {
    account: CONTRACTS.MEMBERS,
    name: 'setcpu',
    authorization: auth(account, permission),
    data: { wallet: account, freecpu: freeCpu }
  }
]

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
