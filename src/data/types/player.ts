import type { KeyValue } from './game'

export interface UserWeekly {
  wallet: string
  quest_id_array: number[]
  total_quest_points: number
  week_start: string
  nft_points_xp: number
  nft_points_qp: number
  completed_quests: number
}

export interface UserPoints {
  user: string
  total_points: number
  redeemable_points: number
  daily_points: number
  weekly_points: number
  top_level_claimed: number
  last_action_timestamp: string
}

export interface Member {
  wallet: string
  member_id: number
  joined: string
  member: number
  trial: number
  flagged: number
  playertag: string
  avatar: string
  avatarrarity: string
  level: number
  experience: number
  total_experience: number
  mcp_gained: number
  mcp_start: number
  mcp_used: number
  last_like: string
  last_bgaction: string
  next_review: string
  vote_power: number
  last_voteclaim_shards: number
  score_nft: number
  tlm_deposit: number
  freecpu: number
  stats: KeyValue[]
  usrsettings: KeyValue<string>[]
}

export interface FlagReason {
  index: number
  title: string
  flag_reason: string
}
