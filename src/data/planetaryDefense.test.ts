import { describe, expect, it } from 'vitest'

import {
  acceptedRequest,
  attackCooldownMs,
  attackReadyAt,
  currentMission,
  effectivePower,
  isOpenRequest,
  missionState,
  pvpJoinable,
  pvpSide,
  teamOf
} from './planetaryDefense'
import type { PdMission, PdOwner, PdPvp, PdRequest, PdSupport } from './types/planetaryDefense'

const NOW = Date.UTC(2026, 8, 19, 12)

const mission = (name: string, deadline: string, completed = false): PdMission => ({
  mission_name: name,
  target_attack_points: 100,
  reward: '10.0000 TLM',
  shards: 5,
  is_completed: completed ? 1 : 0,
  total_attack_points: 10,
  last_hardening_time: 0,
  is_distributed: 0,
  deadline
})

describe('attack missions', () => {
  it('knows live, completed and ended missions', () => {
    expect(missionState(mission('a', '2026-09-20T00:00:00'), NOW)).toBe('live')
    expect(missionState(mission('b', '2026-09-20T00:00:00', true), NOW)).toBe('completed')
    expect(missionState(mission('c', '2026-09-18T00:00:00'), NOW)).toBe('ended')
  })

  it('shows the live mission ending soonest', () => {
    const list = [
      mission('late', '2026-10-01T00:00:00'),
      mission('old', '2026-01-01T00:00:00'),
      mission('soon', '2026-09-25T00:00:00')
    ]
    expect(currentMission(list, NOW)?.mission_name).toBe('soon')
  })

  it('falls back to the mission that ended last', () => {
    const list = [mission('first', '2026-01-01T00:00:00', true), mission('last', '2026-07-20T00:00:00', true)]
    expect(currentMission(list, NOW)?.mission_name).toBe('last')
    expect(currentMission([], NOW)).toBeNull()
  })
})

describe('attack cooldown', () => {
  it('is 3 hours plus 10 seconds per move cost point', () => {
    expect(attackCooldownMs(0)).toBe(3 * 3600 * 1000)
    expect(attackCooldownMs(2002)).toBe((10800 + 20020) * 1000)
  })

  it('counts from the last attack, and is ready at once without one', () => {
    expect(attackReadyAt(1_000_000, 100)).toBe((1_000_000 + 10800 + 1000) * 1000)
    expect(attackReadyAt(undefined, 100)).toBe(0)
  })
})

describe('power', () => {
  const owner: PdOwner = {
    owner_address: 'w.wam',
    land_ids: ['1', '2'],
    numberofland: 2,
    totalAttack: 10,
    totalAttackArm: 15,
    totalDefense: 20,
    totalDefenseArm: 30,
    totalMoveCost: 7
  }

  it('counts the Forge bonus only in the forge', () => {
    expect(effectivePower(owner, false)).toEqual({ attack: 10, defense: 20, moveCost: 7, lands: 2 })
    expect(effectivePower(owner, true)).toMatchObject({ attack: 15, defense: 30 })
    expect(effectivePower(null, true)).toEqual({ attack: 0, defense: 0, moveCost: 0, lands: 0 })
  })
})

describe('land defense teams', () => {
  const supports: PdSupport[] = [
    { owner_address: 'w1.wam', supporters: ['a.wam'], total_defense_score: 1, total_attack_score: 1, totalMoveCost: 0 },
    { owner_address: 'w2.wam', supporters: ['b.wam', 'c.wam'], total_defense_score: 2, total_attack_score: 2, totalMoveCost: 0 }
  ]

  it('finds the team a player supports', () => {
    expect(teamOf(supports, 'c.wam')?.owner_address).toBe('w2.wam')
    expect(teamOf(supports, 'x.wam')).toBeNull()
  })

  const request = (id: number, player: string, warlord: string, status: string, expires = '2026-09-20T00:00:00'): PdRequest => ({
    request_id: id,
    player,
    warlord,
    status,
    request_time: '2026-09-18T00:00:00',
    expiration_time: expires
  })

  it('treats only unexpired pending requests as open', () => {
    expect(isOpenRequest(request(1, 'a', 'w', 'pending'), NOW)).toBe(true)
    expect(isOpenRequest(request(2, 'a', 'w', 'pending', '2026-09-19T00:00:00'), NOW)).toBe(false)
    expect(isOpenRequest(request(3, 'a', 'w', 'accepted'), NOW)).toBe(false)
  })

  it('uses the latest accepted request to leave or remove', () => {
    const list = [
      request(5, 'a', 'w', 'accepted'),
      request(9, 'a', 'w', 'accepted'),
      request(12, 'a', 'x', 'accepted'),
      request(15, 'a', 'w', 'leave')
    ]
    expect(acceptedRequest(list, 'a', 'w')?.request_id).toBe(9)
    expect(acceptedRequest(list, 'b', 'w')).toBeNull()
  })
})

describe('pvp', () => {
  const round = (phase: string, lists: Partial<PdPvp> = {}): PdPvp => ({
    id: 1,
    selected_player: 's.wam',
    land_id: '1',
    defense_list: [],
    attack_list: [],
    defense_score: 0,
    attack_score: 0,
    winner: '',
    phase,
    defense_end_time: NOW / 1000 + 3600,
    attack_end_time: NOW / 1000 + 7200,
    rewards: '1.0000 TLM',
    ...lists
  })

  it('opens the side whose phase is running', () => {
    expect(pvpJoinable(round('defense'), 'a.wam', NOW)).toBe('defense')
    expect(pvpJoinable(round('attack'), 'a.wam', NOW)).toBe('attack')
    expect(pvpJoinable(round('result'), 'a.wam', NOW)).toBeNull()
  })

  it('lets a player take one side only', () => {
    const r = round('attack', { defense_list: ['a.wam'] })
    expect(pvpSide(r, 'a.wam')).toBe('defense')
    expect(pvpJoinable(r, 'a.wam', NOW)).toBeNull()
  })

  it('closes a phase once its time is up', () => {
    expect(pvpJoinable(round('defense', { defense_end_time: NOW / 1000 - 1 }), 'a.wam', NOW)).toBeNull()
  })
})
