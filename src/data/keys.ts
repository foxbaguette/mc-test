/*
 * Every React Query key, per feature. Queries and invalidations both come from here, so a
 * typo can't split one cache entry in two or make a refresh silently miss.
 *
 * Invalidating a shorter key refreshes everything under it: `adventureKeys.inventoryAll`
 * covers every `adventureKeys.inventory(account, schema)`.
 */

type Account = string | null

export const gameKeys = {
  weeks: ['weeks'] as const,
  missionSettings: ['missionSettings'] as const,
  quests: ['quests'] as const,
  collectInfo: ['collectInfo'] as const,
  levels: ['levels'] as const,
  mcSettings: ['mcSettings'] as const,
  tips: ['tips'] as const,
  claimChances: ['claimChances'] as const
}

export const playerKeys = {
  member: (account: Account) => ['member', account] as const,
  userPoints: (account: Account) => ['userPoints', account] as const,
  tlm: (account: Account) => ['tlm', account] as const,
  userWeeklies: (account: Account) => ['userWeeklies', account] as const,
  support: (account: Account) => ['support', account] as const,
  /** Every Mission Control member's gamertag, by wallet. */
  memberTags: ['memberTags'] as const
}

export const miningKeys = {
  awTools: ['awTools'] as const,
  landTypes: ['landTypes'] as const,
  mineTrack: ['mineTrack'] as const,
  planetMinCommission: ['planetMinCommission'] as const,
  planetPools: ['planetPools'] as const,
  suggestedLands: ['suggestedLands'] as const,
  miner: (account: Account) => ['miner', account] as const,
  equippedTools: (account: Account) => ['equippedTools', account] as const,
  toolInventory: (account: Account) => ['toolInventory', account] as const,
  /** Without lands and tool sets: every favorites entry of the account. */
  favorites: (account: Account, landIds?: string, toolSets?: string) =>
    landIds === undefined ? (['favorites', account] as const) : (['favorites', account, landIds, toolSets] as const),
  landTemplates: (planet: string) => ['landTemplates', planet] as const,
  landsOnPlanet: (planet: string, landName: string, filter: object) => ['landsOnPlanet', planet, landName, filter] as const
}

export const toolLoaningKeys = {
  toolOv: ['toolOv'] as const,
  mtools: ['mtools'] as const,
  toolWallet: (account: Account) => ['toolWallet', account] as const,
  stakedTools: (account: Account) => ['stakedTools', account] as const,
  minerClaim: (account: Account) => ['minerClaim', account] as const
}

export const treasureKeys = {
  all: ['treasureHunts'] as const,
  rows: ['treasureHunts', 'rows'] as const,
  finished: (limit: number) => ['treasureHunts', 'finished', limit] as const
}

export const adventureKeys = {
  all: ['adventures'] as const,
  open: ['adventures', 'open'] as const,
  participantsAll: ['adventures', 'participants'] as const,
  participants: (account: Account) => ['adventures', 'participants', account] as const,
  joinedAll: ['adventures', 'joined'] as const,
  /** The joined adventures' ids, sorted and comma-joined. */
  joined: (ids: string) => ['adventures', 'joined', ids] as const,
  templates: ['adventures', 'templates'] as const,
  levels: ['adventures', 'levels'] as const,
  settings: ['adventures', 'settings'] as const,
  inventoryAll: ['adventures', 'inventory'] as const,
  inventory: (account: Account, schema: string) => ['adventures', 'inventory', account, schema] as const
}

export const builderKeys = {
  season: ['builder', 'season'] as const,
  settings: ['builder', 'settings'] as const,
  swappool: ['builder', 'swappool'] as const,
  buildings: ['builder', 'buildings'] as const,
  bonuses: ['builder', 'bonuses'] as const,
  ranking: ['builder', 'ranking'] as const,
  leaderboard: (sort: string) => ['builder', 'leaderboard', sort] as const,
  playerAll: ['builder', 'player'] as const,
  player: (account: Account) => ['builder', 'player', account] as const,
  inventoryAll: ['builder', 'inventory'] as const,
  inventory: (account: Account, schema: string | undefined) => ['builder', 'inventory', account, schema] as const
}

export const emporiumKeys = {
  active: ['emporium', 'active'] as const,
  history: ['emporium', 'history'] as const,
  config: ['emporium', 'config'] as const
}

export const votingKeys = {
  all: ['voting'] as const,
  config: ['voting', 'config'] as const,
  blocklist: ['voting', 'blocklist'] as const,
  history: ['voting', 'history'] as const,
  dao: (planet: string) => ['voting', 'dao', planet] as const,
  votes: (planet: string) => ['voting', 'votes', planet] as const,
  profiles: (planet: string) => ['voting', 'profiles', planet] as const
}

export const vaultKeys = {
  all: ['vault'] as const,
  landComms: (account: Account) => ['vault', 'landComms', account] as const,
  payouts: (account: Account) => ['vault', 'payouts', account] as const
}

export const applicationKeys = {
  all: ['applications'] as const,
  members: ['applications', 'members'] as const,
  reasons: ['applications', 'reasons'] as const,
  supportLog: (wallet: string) => ['applications', 'suplog', wallet] as const
}

export const newsKeys = {
  all: ['news'] as const
}

export const tlmHistoryKeys = {
  month: (account: Account, month: string) => ['tlmHistory', account, month] as const
}

export const shardHistoryKeys = {
  month: (account: Account, month: string) => ['shardHistory', account, month] as const
}

export const pdKeys = {
  all: ['pd'] as const,
  member: (account: Account) => ['pd', 'member', account] as const,
  missions: ['pd', 'missions'] as const,
  playerMissions: (account: Account) => ['pd', 'playerMissions', account] as const,
  power: (account: Account) => ['pd', 'power', account] as const,
  owners: ['pd', 'owners'] as const,
  supports: ['pd', 'supports'] as const,
  requests: (account: Account, as: 'player' | 'warlord') => ['pd', 'requests', account, as] as const,
  defense: ['pd', 'defense'] as const,
  defenseWins: ['pd', 'defenseWins'] as const,
  pvp: ['pd', 'pvp'] as const,
  pvpRoster: (id: number | undefined) => ['pd', 'pvpRoster', id] as const,
  lands: (account: Account) => ['pd', 'lands', account] as const,
  votePower: (account: Account) => ['pd', 'votePower', account] as const,
  defenseWinTimes: ['pd', 'defenseWinTimes'] as const
}
