import { createHash } from 'node:crypto'
import { Name, Serializer } from '@wharfkit/session'
import { describe, expect, it } from 'vitest'

import { findNonce, nameToBytes, powMessage, sha256Short, toHex } from './pow'

const wordsToHex = (words: Uint32Array) => Array.from(words, (w) => (w >>> 0).toString(16).padStart(8, '0')).join('')

describe('nameToBytes', () => {
  it.each(['5thba.wam', 'm.federation', 'a', 'zzzzzzzzzzzzj', '.isqy.wam'])('matches WharfKit serialization for %s', (name) => {
    const expected = Serializer.encode({ object: Name.from(name) }).array
    expect(Array.from(nameToBytes(name))).toEqual(Array.from(expected))
  })
})

describe('sha256Short', () => {
  it('matches node crypto for a 24-byte message', () => {
    const message = powMessage('5thba.wam', '61346261cbac1a2e48efc442464064521d6ef69bec937ac53b0b4fd64c583510')
    message.set([1, 2, 3, 4, 5, 6, 7, 8], 16)
    const out = new Uint32Array(8)
    sha256Short(message, out)
    expect(wordsToHex(out)).toBe(createHash('sha256').update(message).digest('hex'))
  })
})

describe('findNonce', () => {
  it('returns a nonce whose hash satisfies the difficulty', () => {
    const account = '5thba.wam'
    const lastMineTx = '61346261cbac1a2e48efc442464064521d6ef69bec937ac53b0b4fd64c583510'
    const difficulty = 2
    const { nonce } = findNonce({ account, lastMineTx, difficulty })

    const message = powMessage(account, lastMineTx)
    message.set(Buffer.from(nonce, 'hex'), 16)
    const hex = createHash('sha256').update(message).digest('hex')

    expect(nonce).toHaveLength(16)
    expect(hex.startsWith('0000')).toBe(true)
    expect(parseInt(hex[4], 16)).toBeLessThanOrEqual(difficulty)
    expect(toHex(message.subarray(16))).toBe(nonce)
  })
})
