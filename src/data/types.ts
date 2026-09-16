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

export interface KeyValue<V = number> {
  key: string
  value: V
}

/** voting.mc `history`: one row per candidate per vote, kept for roughly the last 30 days. */
export interface VoteHistory {
  index: number
  timestamp: string
  planet: string
  voter: string
  voter_tag: string
  candidate: string
  votes: number
}

/** voting.mc `config`. */
export interface VotingConfig {
  max_votes: number
  paused: number
  decay_per_day: string
}

/** voting.mc `candidates`: votes cast through Mission Control, per planet. */
export interface PlanetCandidate {
  wallet: string
  planet: string
  votes: number
  last_decay: string
}

/** dao.worlds `candidates` (scope = planet). */
export interface DaoCandidate {
  candidate_name: string
  is_active: number
  number_voters: number
  rank: number
}

/** Candidate profile from the Alien Worlds DAO API. */
export interface CandidateProfile {
  account: string
  givenName?: string
  description?: string
  image?: string
}

/** members.mc `reasons`: preset flag reasons for the support team. */
export interface FlagReason {
  index: number
  title: string
  flag_reason: string
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

export interface Level {
  level: number
  description: string
  quest_power: string
  xp_to_level_up: number
}

export interface LevelOffer {
  id: number
  level: number
  template_id: number
  required: number
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

export interface ActivityLog {
  index: number
  wallet: string
  tag: string
  avatar: string
  avatarrarity: string
  level: number
  log: string
  planet: string
  timestamp: string
  type: string
  guild_id: number
}

export interface SponsorLog {
  index: number
  wallet: string
  tag: string
  timestamp: number
  log: string
  avatar: string
  tlm: number
  likes: number
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

export interface Tutorial {
  title: string
  link: string
  image: string
  type: string
  author: string
  creation_date: string
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

export interface Miner {
  miner: string
  last_mine_tx: string
  last_mine: string
  current_land: string
}

export interface Bag {
  account: string
  items: string[]
  locked: number
}

export interface ToolUse {
  asset_id: string
  last_use: number
}

export interface AwTool {
  template_id: number
  toolname: string
  rarity: string
  shine: string
  type: string
  img: string
  cooldown_seconds: number
  mining_power: number
  nft_power: number
  pow: number
}

export interface LandType {
  landtype_id: number
  landname: string
  rarity: string
  img: string
  cooldown_mod: number
  mining_power_mod: number
  nft_power_mod: number
  pow_mod: number
}

export interface PoolBucket {
  key: string
  value: string
}

export interface MineTrack {
  name: string
  data_cutoff: string
  datapoints: number
  last_addition: string
  pool_buckets: PoolBucket[]
}

export interface PlanetPools {
  pool_buckets: PoolBucket[]
}

export interface SuggestedLand {
  planet: string
  land_name: string
  location: string
  asset_id: string
  /** Commission in basis points (500 = 5%); spelled this way on chain. */
  comission?: number
}

/** tools.mc `toolov`: one row per loanable tool template. */
export interface ToolOv {
  template_id: number
  tool_name: string
  rarity: string
  shine: string
  type: string
  cooldown_seconds: number
  pow: number
  mining_power: number
  nft_power: number
  earnings: string
  image: string
  owned: number
  owner_share: number
  renter_share: number
  mc_share: number
  allowed: number
  next_asset_id: number
  readyat: string
}

/** tools.mc `wallets`: a player's tool loaning account. */
export interface ToolWallet {
  user: string
  deposit: string
  trialtlm: string
  tools_loaned: number
  total_earnedm: string
  total_earnedl: string
  tempid_allow_list: number[]
  total_mines: number
  tools_owned: number
}

/** tools.mc `tools`: a tool asset a player has staked for loaning. */
export interface StakedTool {
  asset_id: string
  template_id: number
  owner: string
  total_mines: number
  total_earned: string
  last_mine: string
  readyat: string
  stakedat: string
  owned: number
}

/** tools.mc `mtools`: multi-asset loan tools such as the Certified Kol Digger. */
export interface MTool {
  index: number
  owner: string
  asset_ids: string[]
  template_id: number
  owner_share: number
  renter_share: number
  mc_share: number
  tool_name: string
  rarity: string
  shine: string
  cooldown_seconds: number
  pow: number
  mining_power: number
  nft_power: number
  type: string
  readyat: string
  last_mine: string
}

/** emporium.mc `tasks`: Zapp's tasks, active or completed. */
export interface EmporiumTask {
  task_id: number
  template_id: number
  /** Shards times ten. */
  shards: number
  task_type: string
  title: string
  description: string
  image: string
  button: string
  status: string
  /** Price in the task's currency; TLM in 1/10000 TLM. */
  currency_start: number
  currency_end: number
  user: string
  timestamp_created: string
  timestamp_closed: string
  duration: number
}

/** emporium.mc `config`. */
export interface EmporiumConfig {
  simultaneous_tasks: number
  progressupdate_seconds: number
  tick_percent_decrease: number
}

export interface AdventureMod {
  affix_type: string
  affix_string: string
  affix_value: number
  mod_value: number
  mod_type: string
}

/** adventure.mc `adventures`. */
export interface Adventure {
  adventureid: number
  predefid: number
  title: string
  image: string
  flavor: string
  mods: AdventureMod[]
  players: number
  score_total: number
  enter_start: string
  enter_end: string
  duration_hours: number
  sponsored: number
  sponsor: string
  reward_qp: number
  reward_xp: number
  point_cost: number
}

/** adventure.mc `participants`: one player's team on one adventure. */
export interface AdventureParticipation {
  pid: number
  adventureid: number
  wallet: string
  score: number
  asset_ids: string[]
  template_ids: number[]
  launch_date: string
  return_date: string
}

/** adventure.mc `advtemplates`: card attributes the adventure modifiers match against. */
export interface AdvTemplate {
  templateid: number
  schema: string
  rarity: string
  type: string
  shine: string
  element: string
  race: string
  nftimage: string
  cardname: string
  weaponclass: string
  atk: number
  def: number
  movcost: number
  pow: number
  nft_mp: number
  tlm_mp: number
  level: number
}

/** adventure.mc `levelunlocks`: member level needed for each modifier slot. */
export interface LevelUnlock {
  modslot: number
  level: number
}

/** game.mc `season`: the current Outpost Builder season. */
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
export interface MinerClaim {
  miner: string
  amount: string
  timestamp: string
}

/** Immutable data of an alien.worlds land NFT. */
export interface LandData {
  name: string
  img: string
  rarity: string
  cardid: number
  commission: number
  delay: number
  difficulty: number
  ease: number
  luck: number
  planet: string
  x: number
  y: number
}

/** Immutable data of an alien.worlds tool NFT. */
export interface ToolData {
  name: string
  img: string
  rarity: string
  shine: string
  type: string
  cardid: number
  delay: number
  difficulty: number
  ease: number
  luck: number
}

export interface EquippedTool extends ToolData {
  asset_id: string
  template_id: string
  last_use: number
  cooldown_seconds: number
  mining_power: number
  nft_power: number
  pow: number
  toolname: string
}

export interface CurrentLand extends LandData {
  asset_id: string
  planetName: string
  landName: string
  owner?: string
}
