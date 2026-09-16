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
