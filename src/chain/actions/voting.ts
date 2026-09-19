import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

import { payCpu } from './mining'

// Voting (voting.mc)

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
