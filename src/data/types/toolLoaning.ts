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
