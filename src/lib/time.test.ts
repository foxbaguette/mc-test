import { describe, expect, it } from 'vitest'

import {
  chainDate,
  cooldownLabel,
  countdown,
  durationLabel,
  formatDateNumeric,
  formatUtcDayTime,
  shortDuration,
  timeLeft
} from './time'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('chainDate', () => {
  it('reads chain timestamps without a zone as UTC', () => {
    expect(chainDate('2026-09-16T12:00:00').toISOString()).toBe('2026-09-16T12:00:00.000Z')
  })

  it('keeps an explicit zone', () => {
    expect(chainDate('2026-09-16T12:00:00Z').toISOString()).toBe('2026-09-16T12:00:00.000Z')
    expect(chainDate('2026-09-16T14:00:00+02:00').toISOString()).toBe('2026-09-16T12:00:00.000Z')
  })

  it('is an invalid date for missing values', () => {
    expect(Number.isNaN(+chainDate(undefined))).toBe(true)
    expect(Number.isNaN(+chainDate(''))).toBe(true)
  })
})

describe('timeLeft and countdown', () => {
  it('splits the remaining time into units', () => {
    const t = timeLeft(2 * DAY + 5 * HOUR + 12 * MIN + 30_000, 0)
    expect(t).toMatchObject({ days: 2, hours: 5, minutes: 12, seconds: 30 })
    expect(countdown(t)).toBe('2d 5h 12min')
  })

  it('never goes negative', () => {
    expect(timeLeft(0, 5000).ms).toBe(0)
  })
})

describe('cooldownLabel', () => {
  it('says MINE once the time has passed', () => {
    expect(cooldownLabel(1000, 2000)).toBe('MINE')
  })

  it('shows mm:ss under an hour and hh:mm:ss above', () => {
    expect(cooldownLabel(9 * MIN + 26_000, 0)).toBe('09:26')
    expect(cooldownLabel(DAY + 2 * HOUR + 3 * MIN + 4000, 0)).toBe('26:03:04')
  })

  it('accepts a custom ready label', () => {
    expect(cooldownLabel(0, 0, 'Claim')).toBe('Claim')
  })
})

describe('shortDuration', () => {
  it.each([
    [30_000, '30s'],
    [12 * MIN + 30_000, '12m 30s'],
    [4 * HOUR + 12 * MIN, '4h 12m'],
    [2 * DAY + 4 * HOUR, '2d 4h'],
    [-5000, '0s']
  ])('%i ms → %s', (ms, label) => {
    expect(shortDuration(ms)).toBe(label)
  })
})

describe('date formats', () => {
  it('formats a UTC day and time for chain events', () => {
    expect(formatUtcDayTime(Date.parse('2026-09-16T04:07:00Z'))).toBe('16 Sep, 04:07')
  })

  it('formats a numeric local date', () => {
    expect(formatDateNumeric(new Date(2026, 8, 5))).toBe('05/09/2026')
  })
})

describe('durationLabel', () => {
  it('drops zero units', () => {
    expect(durationLabel(4 * DAY + 3 * MIN, 0)).toBe('4d 3m')
  })
})
