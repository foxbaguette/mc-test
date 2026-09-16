import { describe, expect, it } from 'vitest'

import { formatCompact, tlmToNumber } from './format'

describe('tlmToNumber', () => {
  it('parses chain asset strings', () => {
    expect(tlmToNumber('438.6563 TLM')).toBe(438.6563)
    expect(tlmToNumber('0.0000 TLM')).toBe(0)
  })

  it('treats missing or malformed values as zero', () => {
    expect(tlmToNumber(undefined)).toBe(0)
    expect(tlmToNumber(null)).toBe(0)
    expect(tlmToNumber('not a number')).toBe(0)
  })
})

describe('formatCompact', () => {
  it.each([
    [999, '999 '],
    [1234, '1.2 k'],
    [191445.74, '191.4 k'],
    [2_500_000, '2.5 M']
  ])('%d → "%s"', (value, text) => {
    expect(formatCompact(value)).toBe(text)
  })
})
