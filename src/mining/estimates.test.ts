import { describe, expect, it } from 'vitest'

import type { FavoriteLand } from '@/data/favorites'
import type { EquippedTool } from '@/data/types/mining'

import {
  effectiveCommission,
  estimateTlm,
  mineReadyAt,
  nextFavoriteUpgrade,
  pickFavoriteLand,
  sortFavoriteLands
} from './estimates'

const tool = (delay: number, last_use = 0) => ({ delay, last_use }) as unknown as EquippedTool

describe('mineReadyAt', () => {
  const lastMine = '2026-09-16T12:00:00'
  const lastMineAt = Date.parse('2026-09-16T12:00:00Z')

  it('uses the slowest tool fully with one tool', () => {
    expect(mineReadyAt(10, [tool(600)], lastMine)).toBe(lastMineAt + 600_000)
  })

  it('adds half of the second tool with two tools', () => {
    expect(mineReadyAt(10, [tool(300), tool(600)], lastMine)).toBe(lastMineAt + 750_000)
  })

  it('adds the second tool fully with three tools, ignoring the fastest', () => {
    expect(mineReadyAt(10, [tool(100), tool(300), tool(600)], lastMine)).toBe(lastMineAt + 900_000)
  })

  it('scales by the land delay (10 = 1x)', () => {
    expect(mineReadyAt(15, [tool(600)], lastMine)).toBe(lastMineAt + 900_000)
  })

  it('counts from the latest tool use when it is after the last mine', () => {
    const later = lastMineAt / 1000 + 60
    expect(mineReadyAt(10, [tool(600, later)], lastMine)).toBe(later * 1000 + 600_000)
  })
})

describe('estimateTlm', () => {
  it('caps each rarity share at 80% of its pool', () => {
    expect(estimateTlm({ Common: 1_000_000 }, 10, { Common: 50 })).toBe(40)
  })

  it('adds the rarities together', () => {
    expect(estimateTlm({ Common: 100, Rare: 200 }, 10, { Common: 10, Rare: 20 })).toBeCloseTo(0.1 * 10 + 0.2 * 20)
  })

  it('is 0 without pools', () => {
    expect(estimateTlm({ Common: 100 }, 10, undefined)).toBe(0)
  })
})

describe('effectiveCommission', () => {
  it('never goes below the planet minimum', () => {
    expect(effectiveCommission(0.02, 0.05)).toBe(0.05)
    expect(effectiveCommission(0.2, 0.05)).toBe(0.2)
  })
})

describe('pickFavoriteLand', () => {
  const land = (asset_id: string, readyAt: number, estimatedTlm: number, shards: number) =>
    ({ asset_id, readyAt, estimatedTlm, shards }) as unknown as FavoriteLand & { readyAt: number }
  const readyAt = (l: FavoriteLand) => (l as FavoriteLand & { readyAt: number }).readyAt

  const lands = [land('a', 0, 5, 1), land('b', 0, 2, 9), land('c', 100, 50, 50)]

  it('prefers ready lands, by shards for green', () => {
    expect(pickFavoriteLand(lands, readyAt, 'green', 10)?.asset_id).toBe('b')
  })

  it('prefers ready lands, by TLM for orange', () => {
    expect(pickFavoriteLand(lands, readyAt, 'orange', 10)?.asset_id).toBe('a')
  })

  it('falls back to the soonest land when none is ready', () => {
    const waiting = [land('a', 500, 5, 1), land('b', 200, 1, 1)]
    expect(pickFavoriteLand(waiting, readyAt, 'green', 10)?.asset_id).toBe('b')
  })

  it('is null without lands', () => {
    expect(pickFavoriteLand([], readyAt, 'green', 10)).toBeNull()
  })
})

describe('sortFavoriteLands', () => {
  const entry = (asset_id: string, isReady: boolean, estimatedTlm: number, shards: number, delay = 10) => ({
    land: { asset_id, estimatedTlm, shards, delay } as unknown as FavoriteLand,
    isReady
  })
  const lands = [
    entry('cooling-best', false, 9, 1),
    entry('ready-low', true, 2, 5),
    entry('cooling-low', false, 1, 9),
    entry('ready-high', true, 4, 3)
  ]
  const ids = (list: ReturnType<typeof sortFavoriteLands<(typeof lands)[number]>>) => list.map((l) => l.land.asset_id)

  it('puts ready lands first when sorting by TLM, the best estimate first in each group', () => {
    expect(ids(sortFavoriteLands(lands, 'tlm'))).toEqual(['ready-high', 'ready-low', 'cooling-best', 'cooling-low'])
  })

  it('puts ready lands first when sorting by Shards too', () => {
    expect(ids(sortFavoriteLands(lands, 'shards'))).toEqual(['ready-low', 'ready-high', 'cooling-low', 'cooling-best'])
  })

  it('keeps ready lands first in the ready order', () => {
    expect(ids(sortFavoriteLands(lands, 'ready')).slice(0, 2).sort()).toEqual(['ready-high', 'ready-low'])
  })
})

describe('nextFavoriteUpgrade', () => {
  const land = (asset_id: string, readyAt: number, estimatedTlm: number, shards: number) =>
    ({ asset_id, readyAt, estimatedTlm, shards }) as unknown as FavoriteLand & { readyAt: number }
  const readyAt = (l: FavoriteLand) => (l as FavoriteLand & { readyAt: number }).readyAt

  it('names the soonest land that pays more than the current pick', () => {
    const lands = [land('ready', 0, 5, 5), land('better-late', 900, 20, 20), land('better-soon', 300, 9, 9)]
    expect(nextFavoriteUpgrade(lands, readyAt, 'orange', 10)?.land.asset_id).toBe('better-soon')
    expect(nextFavoriteUpgrade(lands, readyAt, 'orange', 10)?.at).toBe(300)
  })

  it('goes by shards in the shards mode', () => {
    const lands = [land('ready', 0, 1, 5), land('cooling', 300, 50, 4)]
    expect(nextFavoriteUpgrade(lands, readyAt, 'green', 10)).toBeNull()
    expect(nextFavoriteUpgrade(lands, readyAt, 'orange', 10)?.land.asset_id).toBe('cooling')
  })

  it('ignores lands that pay the same or less', () => {
    const lands = [land('ready', 0, 5, 5), land('cooling', 300, 5, 5)]
    expect(nextFavoriteUpgrade(lands, readyAt, 'orange', 10)).toBeNull()
  })

  it('still names a better land while nothing is ready', () => {
    const lands = [land('soonest', 100, 1, 1), land('better', 400, 7, 7)]
    expect(nextFavoriteUpgrade(lands, readyAt, 'orange', 10)?.land.asset_id).toBe('better')
  })

  it('is null without lands', () => {
    expect(nextFavoriteUpgrade([], readyAt, 'orange', 10)).toBeNull()
  })
})
