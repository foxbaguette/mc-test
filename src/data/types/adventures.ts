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
