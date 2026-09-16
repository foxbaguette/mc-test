export interface BuilderSeason {
  index: number
  season_start: string
  season_end: string
  season_mcp_rewards: number
  new_season_prepared: number
  ranking_cleared: number
}

/** game.mc `settings`. */

export interface BuilderSettings {
  manual_mines_per_day: number
  seconds_mine_cd: number
  seconds_market_cd: number
  mcpperqp: number
  season_shards: number
}

/** game.mc `swappool`: the Я / MCP exchange pool (constant product). */

export interface BuilderSwapPool {
  index: number
  mcp: number | string
  gamecurrency: number | string
}

/** game.mc `buildings`: static building definitions. */

export interface BuildingDef {
  buildingid: string
  building_name: string
  building_type: string
  building_description: string
  slot_unlock_levels: number[]
  allowed_schemas: string[]
}

export interface PlayerBuilding {
  buildingid: string
  building_name: string
  building_type: string
  building_level: number
  unlocked_slots: number
  gamecurrency_per_minute_unboosted: number
  nft_bonuspercent: number
  gamecurrency_per_minute_boosted: number
  gamecurrency_upgrade_cost: number
  staked_template_ids: number[]
  staked_asset_ids: string[]
  todays_interactions: number
  last_interaction: string
}

/** game.mc `players`. */

export interface BuilderPlayer {
  wallet: string
  gamertag: string
  gamecurrency: number
  max_gamecurrency: number
  last_claim: string
  gamecurrency_per_minute: number
  buildings: PlayerBuilding[]
  score_mcp: number
  score_building: number
}

/** game.mc `bonuses`: NFT bonus per schema, rarity and shine. */

export interface BuilderBonus {
  index: number
  schema: string
  rarity: string
  shine: string
  bonus_percent: number
}

/** game.mc `ranking`: the previous season's final standings. */

export interface BuilderRanking {
  rank: number
  wallet: string
  gamertag: string
  gc_per_minute: number
  mcp_earned: number
  building_score: number
  shards: number
}

/** m.federation `minerclaim`: Alien Worlds mining rewards waiting to be claimed. */
