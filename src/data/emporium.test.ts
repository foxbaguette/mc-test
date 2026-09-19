import { describe, expect, it } from 'vitest'

import { currentTaskPrice, nextProgressAt, taskPaidAmount } from './emporium'
import type { EmporiumConfig, EmporiumTask } from './types/emporium'
import { votePower } from './voting'

const T0 = Date.parse('2026-09-18T00:00:00Z')
const HOUR = 3_600_000

// Prices drop 10% every hour.
const config: EmporiumConfig = { simultaneous_tasks: 8, progressupdate_seconds: 3600, tick_percent_decrease: 10 }

const task = (overrides: Partial<EmporiumTask>): EmporiumTask =>
  ({
    task_id: 7,
    task_type: 'mcp',
    currency_start: 1000,
    currency_end: 0,
    timestamp_created: '2026-09-18T00:00:00',
    ...overrides
  }) as EmporiumTask

describe("Zapp's task prices", () => {
  it('drop by the tick percentage for every completed progress tick', () => {
    expect(currentTaskPrice(task({}), config, T0 + 30 * 60_000)).toBe(1000) // no tick yet
    expect(currentTaskPrice(task({}), config, T0 + 2.5 * HOUR)).toBe(810) // 1000 × 0.9²
  })

  it('turn TLM prices (1/10000 TLM) into whole TLM, rounded up', () => {
    // 100 TLM start: 81 after two ticks, 72.9 → 73 after three.
    expect(currentTaskPrice(task({ task_type: 'tlm', currency_start: 1_000_000 }), config, T0 + 2 * HOUR)).toBe(81)
    expect(currentTaskPrice(task({ task_type: 'tlm', currency_start: 1_000_000 }), config, T0 + 3 * HOUR)).toBe(73)
  })

  it('never rise above the start price for a clock behind the chain', () => {
    expect(currentTaskPrice(task({}), config, T0 - HOUR)).toBe(1000)
  })

  it('stay at the start price without a config', () => {
    expect(currentTaskPrice(task({}), undefined, T0 + 10 * HOUR)).toBe(1000)
  })

  it('know when the next drop happens', () => {
    expect(nextProgressAt(config, T0 + 2.5 * HOUR)).toBe(T0 + 3 * HOUR)
  })

  it('report what the finishing player paid', () => {
    expect(taskPaidAmount(task({ task_type: 'tlm', currency_end: 1_234_567 }))).toBe(124)
    expect(taskPaidAmount(task({ currency_end: 55 }))).toBe(55)
  })
})

describe('vote power', () => {
  it('is what was claimed plus the shards earned since', () => {
    expect(votePower(1000, 200, 5300, 5000)).toBe(500)
  })

  it('is capped by the contract maximum and never negative', () => {
    expect(votePower(400, 200, 5300, 5000)).toBe(400)
    expect(votePower(1000, 0, 100, 500)).toBe(0)
  })
})
