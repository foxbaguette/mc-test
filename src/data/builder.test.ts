import { describe, expect, it } from 'vitest'

import {
  currentResources,
  estimateMcpForDelivery,
  estimateResourcesForQp,
  exploderGrant,
  exploderUses,
  formatR,
  msUntilFull,
  qpToFillStorage
} from './builder'
import type { BuilderPlayer, BuilderSettings, BuilderSwapPool, PlayerBuilding } from './types/builder'

const T0 = Date.parse('2026-09-18T00:00:00Z')
const MIN = 60_000

const player = (overrides: Partial<BuilderPlayer> = {}): BuilderPlayer => ({
  wallet: 'me.wam',
  gamertag: 'me',
  gamecurrency: 1000,
  max_gamecurrency: 5000,
  last_claim: '2026-09-18T00:00:00',
  gamecurrency_per_minute: 60,
  buildings: [],
  score_mcp: 0,
  score_building: 0,
  ...overrides
})

const building = (overrides: Partial<PlayerBuilding> = {}): PlayerBuilding => ({
  buildingid: 'faucet',
  building_name: 'Exploder',
  building_type: 'special',
  building_level: 2,
  unlocked_slots: 0,
  gamecurrency_per_minute_unboosted: 0,
  nft_bonuspercent: 10,
  gamecurrency_per_minute_boosted: 0,
  gamecurrency_upgrade_cost: 0,
  staked_template_ids: [],
  staked_asset_ids: [],
  todays_interactions: 3,
  last_interaction: '2026-09-18T06:00:00',
  ...overrides
})

// 1,000,000 MCP against 2,000,000 Я: constant product 2e12.
const pool: BuilderSwapPool = { index: 0, mcp: '1000000', gamecurrency: '2000000' }
const settings: BuilderSettings = {
  manual_mines_per_day: 10,
  seconds_mine_cd: 0,
  seconds_market_cd: 0,
  mcpperqp: 10,
  season_shards: 0
}

describe('resources', () => {
  it('grow per minute since the last claim', () => {
    // 10 minutes at 60 Я per minute on top of 1,000.
    expect(currentResources(player(), T0 + 10 * MIN)).toBe(1600)
  })

  it('stop at the storage limit', () => {
    expect(currentResources(player(), T0 + 2 * 60 * MIN)).toBe(5000)
  })

  it('never go below the stored amount for a clock behind the chain', () => {
    expect(currentResources(player(), T0 - MIN)).toBe(1000)
  })

  it('tell how long until the storage is full', () => {
    // 3,400 Я missing at 60 per minute.
    expect(msUntilFull(player(), T0 + 10 * MIN)).toBeCloseTo((3400 / 60) * MIN)
    expect(msUntilFull(player({ gamecurrency_per_minute: 0 }), T0)).toBe(0)
  })
})

describe('Exploder', () => {
  it('counts uses per UTC day, as the contract does', () => {
    expect(exploderUses(building(), Date.parse('2026-09-18T23:59:59Z'))).toBe(3)
    expect(exploderUses(building(), Date.parse('2026-09-19T00:00:00Z'))).toBe(0)
  })

  it('grants rate × level, with the NFT bonus, and five times on the first use of the day', () => {
    const sameDay = Date.parse('2026-09-18T12:00:00Z')
    const nextDay = Date.parse('2026-09-19T12:00:00Z')
    expect(exploderGrant(building(), player(), sameDay)).toBe(132) // 60 × 2 × 1.1
    expect(exploderGrant(building(), player(), nextDay)).toBe(660) // 60 × 2 × 5 × 1.1
  })

  it('grants at least 100', () => {
    expect(exploderGrant(building({ building_level: 1 }), player({ gamecurrency_per_minute: 10 }), T0 + MIN)).toBe(100)
  })
})

describe('Spaceport and quest point exchange (constant-product pool)', () => {
  it('pays MCP for a delivery, with the Spaceport level and NFT bonus added to what enters', () => {
    // 100,000 Я × 1.15 enters: 1,000,000 − 2e12 / 2,115,000.
    expect(estimateMcpForDelivery(pool, 100_000, building({ building_level: 5, nft_bonuspercent: 10 }))).toBe(54_373)
    expect(estimateMcpForDelivery(pool, 0, building())).toBe(0)
    expect(estimateMcpForDelivery(null, 100, building())).toBe(0)
  })

  it('gives Я for quest points, capped by free storage', () => {
    // 100 quest points × 10 MCP each: 2,000,000 − 2e12 / 1,001,000.
    expect(estimateResourcesForQp(pool, settings, 100, 1e9)).toBeCloseTo(1998.002, 3)
    expect(estimateResourcesForQp(pool, settings, 100, 1500)).toBe(1500)
    expect(estimateResourcesForQp(pool, settings, 0, 1e9)).toBe(0)
  })

  it('works out the quest points that fill the storage, and those points do fill it', () => {
    const qp = qpToFillStorage(pool, settings, 3002, 5000)
    expect(qp).toBe(100)
    expect(estimateResourcesForQp(pool, settings, qp, Infinity)).toBeGreaterThanOrEqual(5000 - 3002)
    expect(qpToFillStorage(undefined, settings, 0, 5000)).toBe(0)
  })
})

describe('formatR', () => {
  it('writes amounts the way the original Builder did', () => {
    expect(formatR(999)).toBe('999')
    expect(formatR(8_352_000)).toBe('8,352 k')
    expect(formatR(1_234_567)).toBe('1,235 k')
    expect(formatR(2_500_000_000)).toBe('2,500 M')
  })
})
