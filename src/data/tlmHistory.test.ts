import { describe, expect, it } from 'vitest'

import { labelOf, monthKey, monthRange, shiftMonth, sourceOf, summarize, type TlmTransfer } from './tlmHistory'

describe('sourceOf', () => {
  it.each([
    ['missions.mc', 'mc'],
    ['admin.mc', 'mc'],
    ['planetaworld', 'mc'],
    ['quests.ale', 'ale'],
    ['miss.pdef', 'pdef'],
    ['magordefense', 'pdef'],
    ['botplanetary', 'pdef'],
    ['theminergame', 'naron'],
    ['m.federation', 'aw'],
    ['awlndratings', 'aw'],
    ['stake.worlds', 'aw'],
    ['naron.world', 'aw'],
    ['naron.dac', 'aw'],
    ['arkhive.lore', 'aw'],
    ['alienhelpers', 'aw'],
    ['swap.alcor', 'other'],
    ['tlmsplitting', 'other'],
    ['5thba.wam', 'other']
  ])('%s → %s', (from, source) => {
    expect(sourceOf(from)).toBe(source)
  })
})

describe('labelOf', () => {
  it.each([
    ['miss.pdef', 'Mission division reward', 'Mission reward'],
    ['magordefense', 'Land TLM payout 1099512958821', 'Land payout'],
    ['magordefense', 'Payout from PVP reward', 'PvP reward'],
    ['magordefense', 'Reward planetary defense', 'Mission reward'],
    ['quests.ale', 'Alien Legends Quest Reward', 'Quest completed'],
    ['pools.ale', 'Player Mining Reward', 'Mining reward'],
    ['missions.mc', 'Mission Control: Week 42 claimed', 'Weekly Rewards'],
    ['planetaworld', 'Treasure reward: ninja', 'Treasure Hunt'],
    ['m.federation', 'ALIEN WORLDS - Mined Trilium', 'Mining'],
    ['m.federation', 'ALIEN WORLDS - Mined Trilium Profit Share', 'Landowner share'],
    ['swap.alcor', 'Swap tokenOut - Pool ID 12', 'Swap'],
    ['swap.taco', 'liquidity withdraw', 'Liquidity'],
    ['alienhelpers', 'Alien Worlds Official 👾', 'Alien Helpers'],
    ['cosmicclasht', 'Drone Racing 3 - Final', 'Drone Racing 3 - Final'],
    ['5thba.wam', '', '5thba.wam']
  ])('%s "%s" → %s', (from, memo, label) => {
    expect(labelOf(from, memo)).toBe(label)
  })
})

describe('months', () => {
  it('keys a date by its UTC month', () => {
    expect(monthKey(new Date('2026-09-30T23:30:00Z'))).toBe('2026-09')
    expect(monthKey(new Date('2026-10-01T00:00:00Z'))).toBe('2026-10')
  })

  it('spans the whole month in UTC', () => {
    const { start, end } = monthRange('2026-02')
    expect(new Date(start).toISOString()).toBe('2026-02-01T00:00:00.000Z')
    expect(new Date(end).toISOString()).toBe('2026-03-01T00:00:00.000Z')
  })

  it('steps across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })
})

describe('summarize', () => {
  const transfer = (source: TlmTransfer['source'], amount: number): TlmTransfer => ({
    id: String(Math.random()),
    trxId: '',
    at: 0,
    from: '',
    label: '',
    amount,
    memo: '',
    source
  })

  it('totals every source and counts transfers', () => {
    const { total, bySource } = summarize([transfer('mc', 10), transfer('mc', 5.5), transfer('naron', 2), transfer('other', 1)])
    expect(total).toBe(18.5)
    expect(bySource.get('mc')).toEqual({ amount: 15.5, count: 2 })
    expect(bySource.get('naron')).toEqual({ amount: 2, count: 1 })
    expect(bySource.get('ale')).toEqual({ amount: 0, count: 0 })
  })
})
