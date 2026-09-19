export const CHAIN_ID = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4'

export const APP_NAME = 'mission-control'

/**
 * Candidate WAX API nodes (CORS verified). The order is only a hint: the real
 * order is decided at runtime by EndpointPool.probe(), see endpoints.ts.
 */
export const RPC_NODES: readonly string[] = [
  'https://wax.greymass.com',
  'https://api.hivebp.io',
  'https://wax.eosdac.io',
  'https://wax.blacklusion.io',
  'https://api.waxsweden.org',
  'https://api.wax.bountyblok.io',
  'https://wax.eosusa.io',
  'https://wax.eosphere.io',
  'https://wax.api.eosnation.io',
  'https://api.wax.alohaeos.com',
  'https://wax.cryptolions.io'
]

/**
 * text/plain is CORS-safelisted, so chain POSTs skip the OPTIONS preflight
 * (some nodes reject preflights outright). Nodes ignore the content type.
 */
export const CORS_SAFE_CONTENT_TYPE = 'text/plain;charset=UTF-8'

/** Hyperion nodes, used to read back the result of a mine transaction. */
export const HISTORY_NODES = ['https://wax.cryptolions.io', 'https://wax.eosphere.io', 'https://wax.eosusa.io']

export const ATOMIC_NODES = [
  'https://atomicassets-api.alienworlds.io',
  'https://wax.api.atomicassets.io',
  'https://wax-atomic-api.eosphere.io'
]

export const AW_IMAGE_URL = 'https://ipfs.alienworlds.io'
export const DEFAULT_AVATAR = `${AW_IMAGE_URL}/ipfs/QmWmAY3NELbkjLVk4qWrpBEafaS1wPJFwhsUNgRcurVox4`

export const DISCORD_URL = 'https://discord.gg/EmpMt7NDsV'

export const CONTRACTS = {
  MISSIONS: 'missions.mc',
  MEMBERS: 'members.mc',
  VOTING: 'voting.mc',
  DAO_WORLDS: 'dao.worlds',
  TOOLS: 'tools.mc',
  ATOMICASSETS: 'atomicassets',
  EMPORIUM: 'emporium.mc',
  GAME: 'game.mc',
  ADVENTURE: 'adventure.mc',
  CPU: 'cpu.mc',
  NOTIFY: 'notify.mc',
  PLANETAWORLD: 'planetaworld',
  USPTS: 'uspts.worlds',
  ALIEN_WORLDS: 'alien.worlds',
  M_FEDERATION: 'm.federation',
  FEDERATION: 'federation',
  HQ_MU: 'hq.mu',
  AWLNDRATINGS: 'awlndratings'
} as const

export const PLANETS = ['eyeke', 'kavian', 'veles', 'magor', 'neri', 'naron'] as const
export type Planet = (typeof PLANETS)[number]

export const PLANET_SCOPES: Record<Planet, string> = {
  eyeke: 'eyeke.world',
  kavian: 'kavian.world',
  veles: 'veles.world',
  magor: 'magor.world',
  neri: 'neri.world',
  naron: 'naron.world'
}

export const LAND_NAMES = [
  'Rocky Desert',
  'Grassland',
  'Dormant Volcano',
  'Icy Mountains',
  'Rocky Crater',
  'Sandy Desert',
  'Mountains',
  'Icy Desert',
  'Rocky Coastline',
  'Plains',
  'Methane Swampland',
  'Small Island',
  'Dunes',
  'Tree Forest',
  'Geothermal Springs',
  'Active Volcano',
  'Mushroom Forest',
  'Inland River',
  'Grass Coastline',
  'Sandy Coastline'
]

export const RARITY_ORDER: Record<string, number> = {
  Mythical: 0,
  Legendary: 1,
  Epic: 2,
  Rare: 3,
  Common: 4,
  Abundant: 5
}

export const RARITY_COLORS: Record<string, string> = {
  Abundant: '#737373',
  Common: '#232323',
  Rare: '#3d74e9',
  Epic: '#8719f0',
  Legendary: '#da992e',
  Mythical: '#d20066'
}
