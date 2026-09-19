import { describe, expect, it } from 'vitest'

import {
  bestTeam,
  estimatedRp,
  idRanges,
  modMatches,
  nextAdventureAt,
  teamScore,
  type ModUnlocks,
  type TeamCandidate
} from './adventures'
import type { Adventure, AdventureMod, AdvTemplate } from './types/adventures'

const HOUR = 3_600_000

const template = (overrides: Partial<AdvTemplate>): AdvTemplate =>
  ({
    templateid: 1,
    schema: 'crew.worlds',
    rarity: 'Common',
    type: '',
    shine: 'Stone',
    element: 'Air',
    race: 'Human',
    nftimage: '',
    cardname: 'Card',
    weaponclass: '',
    atk: 1,
    def: 1,
    movcost: 1,
    pow: 0,
    nft_mp: 0,
    ...overrides
  }) as AdvTemplate

const mod = (affix_type: string, affix_string: string, mod_value: number, affix_value = 99999): AdventureMod => ({
  affix_type,
  affix_string,
  affix_value,
  mod_value,
  mod_type: ''
})

const allUnlocked = { isUnlocked: () => true, levelFor: () => 1 } as ModUnlocks
const firstThreeUnlocked = { isUnlocked: (slot: number) => slot < 3, levelFor: () => 1 } as ModUnlocks

describe('modMatches', () => {
  it('matches string affixes case-insensitively', () => {
    expect(modMatches(mod('race', 'human', 20), template({ race: 'Human' }))).toBe(true)
    expect(modMatches(mod('rarity', 'Rare', 20), template({ rarity: 'Common' }))).toBe(false)
  })

  it('matches element against the weapon class too', () => {
    expect(modMatches(mod('element', 'Gun', 20), template({ element: 'Fire', weaponclass: 'Gun' }))).toBe(true)
  })

  it('matches numeric affixes by value, and ignores the 99999 placeholder', () => {
    expect(modMatches(mod('atk', '-', 20, 5), template({ atk: 5 }))).toBe(true)
    expect(modMatches(mod('atk', '-', 20, 99999), template({ atk: 99999 }))).toBe(false)
  })
})

describe('teamScore', () => {
  const mods = [mod('race', 'Human', 20), mod('element', 'Air', 50), mod('rarity', 'Epic', 30)]

  it('starts at 100 and multiplies by every matched modifier once', () => {
    const cards = [template({ race: 'Human', element: 'Air' }), template({ race: 'Human' })]
    const { score, matched } = teamScore(mods, allUnlocked, cards)
    expect([...matched]).toEqual([0, 1])
    expect(score).toBe(Math.floor(100 * 1.2 * 1.5))
  })

  it('ignores locked modifier slots', () => {
    const locked = { isUnlocked: (slot: number) => slot !== 1, levelFor: () => 1 } as ModUnlocks
    expect(teamScore(mods, locked, [template({ race: 'Human', element: 'Air' })]).score).toBe(120)
  })

  it('is 100 with no cards', () => {
    expect(teamScore(mods, allUnlocked, [undefined, undefined, undefined]).score).toBe(100)
  })
})

describe('bestTeam', () => {
  const candidate = (id: string, overrides: Partial<AdvTemplate>): TeamCandidate => ({
    asset_id: id,
    template_id: Number(id),
    template: template(overrides)
  })

  it('picks the combination with the highest score, at most three cards', () => {
    const mods = [mod('race', 'Nordic', 30), mod('element', 'Fire', 50), mod('rarity', 'Epic', 20), mod('race', 'Grey', 10)]
    const picks = bestTeam(mods, allUnlocked, [
      candidate('1', { race: 'Nordic', element: 'Air', rarity: 'Common' }),
      candidate('2', { race: 'Human', element: 'Fire', rarity: 'Epic' }),
      candidate('3', { race: 'Grey', element: 'Air', rarity: 'Common' }),
      candidate('4', { race: 'Human', element: 'Air', rarity: 'Common' })
    ])
    expect(picks.map((p) => p.asset_id).sort()).toEqual(['1', '2', '3'])
  })

  it('takes the lower shine when a higher one adds nothing', () => {
    const mods = [mod('race', 'Nordic', 30)]
    const picks = bestTeam(mods, allUnlocked, [
      candidate('1', { race: 'Nordic', shine: 'Antimatter' }),
      candidate('2', { race: 'Nordic', shine: 'Gold' }),
      candidate('3', { race: 'Nordic', shine: 'Stone' })
    ])
    expect(picks.map((p) => p.asset_id)).toEqual(['3'])
  })

  it('keeps a higher shine when the adventure asks for it', () => {
    const mods = [mod('race', 'Nordic', 30), mod('shine', 'Gold', 20)]
    const picks = bestTeam(mods, allUnlocked, [
      candidate('1', { race: 'Nordic', shine: 'Stone' }),
      candidate('2', { race: 'Nordic', shine: 'Gold' })
    ])
    expect(picks.map((p) => p.asset_id)).toEqual(['2'])
  })

  it('skips a card whose objectives another card already covers', () => {
    const mods = [mod('race', 'Nordic', 30), mod('element', 'Fire', 50)]
    const picks = bestTeam(mods, allUnlocked, [
      candidate('1', { race: 'Nordic', element: 'Air' }),
      candidate('2', { race: 'Nordic', element: 'Fire' })
    ])
    expect(picks.map((p) => p.asset_id)).toEqual(['2'])
  })

  it('does not count locked slots', () => {
    const mods = [mod('race', 'Nordic', 30), mod('race', 'Grey', 10), mod('element', 'Air', 10), mod('rarity', 'Epic', 90)]
    const picks = bestTeam(mods, firstThreeUnlocked, [candidate('1', { rarity: 'Epic', race: 'Human', element: 'Fire' })])
    expect(picks).toEqual([])
  })

  it('returns nothing when no card matches', () => {
    expect(bestTeam([mod('race', 'Nordic', 30)], allUnlocked, [candidate('1', { race: 'Human' })])).toEqual([])
  })
})

describe('estimatedRp', () => {
  it('pays the share of the total score', () => {
    expect(estimatedRp(100, 1000, 7500)).toBe(750)
  })

  it('does not divide by zero', () => {
    expect(estimatedRp(0, 0, 7500)).toBe(0)
  })
})

describe('nextAdventureAt', () => {
  const adventure = (start: string) => ({ enter_start: start }) as Adventure
  const newest = Date.parse('2026-09-16T00:00:00Z')

  it('is the newest start plus one interval while that is still ahead', () => {
    expect(nextAdventureAt([adventure('2026-09-16T00:00:00')], 24, newest + HOUR)).toBe(newest + 24 * HOUR)
  })

  it('rolls forward over missed slots', () => {
    expect(nextAdventureAt([adventure('2026-09-16T00:00:00')], 24, newest + 50 * HOUR)).toBe(newest + 72 * HOUR)
  })

  it('is 0 without an interval or adventures', () => {
    expect(nextAdventureAt([], 24, newest)).toBe(0)
    expect(nextAdventureAt([adventure('2026-09-16T00:00:00')], undefined, newest)).toBe(0)
  })
})

describe('idRanges', () => {
  it('reads small gaps along and splits at large ones', () => {
    // vauas.wam's joined adventures: one range 672–1207 would read 536 adventures for 35.
    const ids = [
      672, 829, 888, 1070, 1072, 1076, 1078, 1091, 1092, 1094, 1115, 1118, 1119, 1121, 1125, 1126, 1133, 1135, 1138, 1144, 1145,
      1150, 1154, 1155, 1160, 1161, 1167, 1168, 1174, 1175, 1179, 1189, 1197, 1203, 1207
    ]
    const ranges = idRanges(ids)
    expect(ranges).toEqual([
      [672, 672],
      [829, 829],
      [888, 888],
      [1070, 1078],
      [1091, 1094],
      [1115, 1207]
    ])
    expect(ranges.reduce((rows, [from, to]) => rows + to - from + 1, 0)).toBe(109)
  })

  it('handles none, one and a custom gap', () => {
    expect(idRanges([])).toEqual([])
    expect(idRanges([5])).toEqual([[5, 5]])
    expect(idRanges([1, 3, 6], 2)).toEqual([
      [1, 3],
      [6, 6]
    ])
  })
})
