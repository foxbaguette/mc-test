/** Rows of the Planetary Defense contract (magordefense). */

export interface PdMission {
  mission_name: string
  target_attack_points: number
  /** "100000.0000 TLM" */
  reward: string
  shards: number
  is_completed: number | boolean
  total_attack_points: number
  last_hardening_time: number
  is_distributed: number | boolean
  /** UTC, without a zone suffix. */
  deadline: string
}

/** One player's part in one attack mission. */
export interface PdPlayerMission {
  id: number
  mission_name: string
  player: string
  attack_points: number
  /** Unix seconds. */
  last_participation_time: number
}

export interface PdPower {
  totalDefense: number
  /** With the Forge bonus, which counts while the player is in the forge table. */
  totalDefenseArm: number
  totalAttack: number
  totalAttackArm: number
  totalMoveCost: number
}

export interface PdPlayer extends PdPower {
  player_address: string
}

/** A land owner: a warlord other players can support. */
export interface PdOwner extends PdPower {
  owner_address: string
  land_ids: string[]
  numberofland: number
}

/** A warlord's team and its combined scores. */
export interface PdSupport {
  owner_address: string
  supporters: string[]
  total_defense_score: number
  total_attack_score: number
  totalMoveCost: number
}

export type PdRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'leave'

/** A player's request to join a warlord's team. */
export interface PdRequest {
  request_id: number
  player: string
  warlord: string
  status: PdRequestStatus | string
  request_time: string
  expiration_time: string
}

export interface PdDefenseMission {
  id: number
  mission_name: string
  /** Defense points needed per land. */
  target: number
  rewards: number
}

/** A finished defense mission, per warlord: shards[0] went to the warlord, shards[i + 1] to supporters[i]. */
export interface PdDefenseWin {
  id: number
  owner_address: string
  mission_name: string
  land_ids: string[]
  supporters: string[]
  shards: number[]
}

export type PdPvpPhase = 'defense' | 'attack' | 'result' | string

export interface PdPvp {
  id: number
  selected_player: string
  land_id: string
  defense_list: string[]
  attack_list: string[]
  defense_score: number
  attack_score: number
  winner: string
  phase: PdPvpPhase
  /** Unix seconds. */
  defense_end_time: number
  attack_end_time: number
  /** "3519.0000 TLM" */
  rewards: string
}

/** A land's chest: PDT (1 PDT = 1 TLM) waiting to be paid out, and how well it is protected. */
export interface PdChest {
  land_id: string
  owner: string
  chest_level: number
  /** PDT held, in whole tokens. */
  TLM: number
}
