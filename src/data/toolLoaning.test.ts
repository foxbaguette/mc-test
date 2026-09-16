import { describe, expect, it } from 'vitest'

import { depositState, KOL_DIGGER, levelAllows, pickBestLoanTool, type LoanTool } from './toolLoaning'
import type { ToolWallet } from './types/toolLoaning'

describe('levelAllows', () => {
  const rare = { tool_name: 'Barrel Digger', rarity: 'Rare' }
  const epic = { tool_name: 'Advanced TD', rarity: 'Epic' }
  const kol = { tool_name: KOL_DIGGER, rarity: 'Common' }

  it('only allows the Kol Digger below 2840 points', () => {
    expect(levelAllows(100, kol)).toBe(true)
    expect(levelAllows(100, rare)).toBe(false)
  })

  it('stops offering the Kol Digger once other tools unlock', () => {
    expect(levelAllows(2840, kol)).toBe(false)
    expect(levelAllows(2840, rare)).toBe(true)
  })

  it('unlocks rarer tools with more points', () => {
    expect(levelAllows(9649, epic)).toBe(false)
    expect(levelAllows(9650, epic)).toBe(true)
  })
})

describe('pickBestLoanTool', () => {
  const loan = (tool_name: string, rarity: string, mining_power: number, readyAt: number) =>
    ({ tool_name, rarity, mining_power, readyAt }) as LoanTool

  it('picks the rarest ready tool, then the most mining power', () => {
    const tools = [
      loan('a', 'Common', 50, 0),
      loan('b', 'Rare', 10, 0),
      loan('c', 'Rare', 20, 0),
      loan('d', 'Legendary', 90, 999)
    ]
    expect(pickBestLoanTool(tools, 100)?.tool_name).toBe('c')
  })

  it('falls back to the tool that is ready soonest', () => {
    const tools = [loan('a', 'Epic', 50, 500), loan('b', 'Common', 10, 200)]
    expect(pickBestLoanTool(tools, 100)?.tool_name).toBe('b')
  })

  it('is null without tools', () => {
    expect(pickBestLoanTool([], 0)).toBeNull()
  })
})

describe('depositState', () => {
  it('shows real deposits as they are', () => {
    expect(depositState({ deposit: '2712.0000 TLM', trialtlm: '0.0000 TLM' } as ToolWallet)).toMatchObject({
      value: 2712,
      negative: false,
      text: '2712.0000'
    })
  })

  it('shows trial TLM as a negative deposit until real TLM arrives', () => {
    expect(depositState({ deposit: '0.0000 TLM', trialtlm: '50.0000 TLM' } as ToolWallet)).toMatchObject({
      negative: true,
      text: '- 50.0000'
    })
  })
})
