import type { AnyAction } from '@wharfkit/session'

import { CONTRACTS } from '@/chain/config'

import { auth } from './shared'

// Planetary Defense (magordefense). Every action here is signed by the player alone, as on
// planetarydefense.io; the contract checks cooldowns, phases and team rules itself.

const pd = (name: string, account: string, permission: string, data: Record<string, unknown>): AnyAction => ({
  account: CONTRACTS.PLANETARY_DEFENSE,
  name,
  authorization: auth(account, permission),
  data
})

/** Attack the current attack mission with the player's attack power. */
export const pdAttackAction = (account: string, permission: string, missionName: string) =>
  pd('sendattack', account, permission, { player: account, mission_name: missionName })

/** Ask a warlord to join their team for land defense. */
export const pdRequestAction = (account: string, permission: string, warlord: string) =>
  pd('sendreq', account, permission, { player: account, warlord })

export const pdCancelRequestAction = (account: string, permission: string, requestId: number) =>
  pd('cancelreq', account, permission, { request_id: requestId, player: account })

/** Leave the warlord's team the player joined through `requestId`. */
export const pdLeaveTeamAction = (account: string, permission: string, requestId: number) =>
  pd('leaveowner', account, permission, { player: account, request_id: requestId })

/** A warlord's answer to a join request. */
export const pdRespondAction = (account: string, permission: string, requestId: number, accept: boolean) =>
  pd('respondreq', account, permission, {
    request_id: requestId,
    warlord: account,
    response: accept ? 'accepted' : 'declined'
  })

/** A warlord removes a supporter from their team. */
export const pdRemoveSupporterAction = (account: string, permission: string, player: string, requestId: number) =>
  pd('delsupport', account, permission, { player, owner: account, request_id: requestId })

/** Join the current PvP round on the side whose phase is open. */
export const pdJoinPvpAction = (account: string, permission: string, pvpId: number, side: 'defense' | 'attack') =>
  side === 'defense'
    ? pd('adddefense', account, permission, { pvp_id: pvpId, defender: account })
    : pd('addattack', account, permission, { pvp_id: pvpId, attacker: account })
