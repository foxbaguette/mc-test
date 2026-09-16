export interface Week {
  week_id: number
  start_date: string
  end_date: string
  total_quest_points: number
  quests_completed: number
  initial_prize_pool: string
  unclaimed_prize_pool: string
  remaining_prize_pool: string
}

export interface MissionSettings {
  user_claimable_weeks: number
  cost_nftpoints_claim: number
  cost_nftpoints_per_xp: number
  cost_nftpoints_per_qp: number
  max_weekly_nftpoints_xp: number
  max_weekly_nftpoints_qp: number
  max_weekly_tlm_xp: number
  percent_xp_boost_per_percent_spent: number
  rng_index: number
}

export interface Quest {
  quest_id: number
  quest_collection: string
  quest_smartcontract: string
  quest_description: string
  quest_points_per_completion: string
  quest_max_completions: number
  quest_map: string
  quest_active: number
  quest_start_date: string
  quest_end_date: string
  game_real_name: string
  game_info: string
  game_logo_url: string
  game_telegram: string
  game_discord: string
  game_website: string
}

export interface CollectInfo {
  collection: string
  colrealname: string
  info_text: string
  logo: string
  telegram: string
  discord: string
  game_link: string
  active: string
  score: string
  last_score_update: string
}

export interface KeyValue<V = number> {
  key: string
  value: V
}

/** voting.mc `history`: one row per candidate per vote, kept for roughly the last 30 days. */

export interface Level {
  level: number
  description: string
  quest_power: string
  xp_to_level_up: number
}

export interface McSettings {
  decay: number
  likecd_minutes: number
  logdays: number
  raf_bonus: number
  raf_days: number
  signup_cost: string
  standard_avatar: string
  wallet: string
}

export interface ClaimChance {
  index: number
  title: string
  color: string
  size_weight: number
  chance_weight: number
  mcp: number
  order: number
}

export interface Tip {
  description: string
}

export interface Blog {
  id: number
  blogid: string
  blogname: string
}

export interface Treasure {
  is_distributed: number
  land_id: string
  reward: string
  start_date: string
  target: number
  target_type: string
  treasure_name: string
}
