import { describe, expect, it } from 'vitest'

import { weekState } from './game'
import type { Week } from './types/game'

const week = (id: number, start: string, end: string, pool = '1000.0000 TLM'): Week => ({
  week_id: id,
  start_date: start,
  end_date: end,
  total_quest_points: 0,
  quests_completed: 0,
  initial_prize_pool: pool,
  unclaimed_prize_pool: '0.0000 TLM',
  remaining_prize_pool: '0.0000 TLM'
})

const weeks = [
  week(177, '2026-09-07T00:00:00', '2026-09-14T00:00:00', '150000.0000 TLM'),
  week(178, '2026-09-14T00:00:00', '2026-09-21T00:00:00', '191445.7400 TLM')
]

describe('weekState', () => {
  it('finds the week in progress, its pool and when it ends', () => {
    const state = weekState(weeks, Date.parse('2026-09-16T12:00:00Z'))
    expect(state.currentWeek?.week_id).toBe(178)
    expect(state.prizePool).toBe(191445.74)
    expect(state.nextBoundary).toBe(Date.parse('2026-09-21T00:00:00Z'))
  })

  it('rolls over exactly at the end of a week', () => {
    expect(weekState(weeks, Date.parse('2026-09-13T23:59:59Z')).currentWeek?.week_id).toBe(177)
    expect(weekState(weeks, Date.parse('2026-09-14T00:00:00Z')).currentWeek?.week_id).toBe(178)
  })

  it('between weeks, waits for the next start', () => {
    const gap = [week(1, '2026-09-01T00:00:00', '2026-09-07T00:00:00'), week(2, '2026-09-08T00:00:00', '2026-09-15T00:00:00')]
    const state = weekState(gap, Date.parse('2026-09-07T12:00:00Z'))
    expect(state.currentWeek).toBeUndefined()
    expect(state.prizePool).toBe(0)
    expect(state.nextBoundary).toBe(Date.parse('2026-09-08T00:00:00Z'))
  })

  it('has no boundary after the last known week', () => {
    expect(weekState(weeks, Date.parse('2026-10-01T00:00:00Z')).nextBoundary).toBeUndefined()
  })
})
