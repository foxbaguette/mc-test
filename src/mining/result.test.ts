import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mineResultMessage } from './result'

const TX = 'a1b2c3d4e5f6'
const logmine = { act: { account: 'notify.world', name: 'logmine', data: { bounty: '1.2345 TLM', params: { luck: 25 } } } }
const mine = { act: { account: 'm.federation', name: 'mine', data: {} } }

type Answer = (url: string, signal: AbortSignal) => Promise<Response>

/** Each history node answers through its own handler; `calls` records every URL asked for. */
function nodes(byHost: Record<string, Answer>) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push(url)
      const host = Object.keys(byHost).find((h) => url.includes(h))
      return host ? byHost[host](url, init.signal!) : Promise.reject(new Error('unknown node'))
    })
  )
  return calls
}

const json = (body: unknown) => Promise.resolve(Response.json(body))
const hang: Answer = (_url, signal) =>
  new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('mineResultMessage', () => {
  it('looks up the transaction it was given, polling until a node has indexed it', async () => {
    let lookups = 0
    const calls = nodes({
      eosdac: () => json({ actions: ++lookups > 1 ? [mine, logmine] : [mine] }),
      waxsweden: () => json({ actions: [mine] }),
      detroitledger: () => json({ actions: [mine] }),
      sentnl: () => json({ actions: [mine] })
    })

    const message = mineResultMessage(TX)
    await vi.advanceTimersByTimeAsync(1500)
    expect(calls).toHaveLength(4)
    await vi.advanceTimersByTimeAsync(1500)

    expect(await message).toBe('You mined 1.2345 TLM & 2.5 Shards')
    expect(calls.every((url) => url.includes('/v2/history/get_transaction') && url.includes(`id=${TX}`))).toBe(true)
  })

  it('takes the first node that has it, without waiting for a hanging one', async () => {
    nodes({ eosdac: hang, waxsweden: hang, detroitledger: hang, sentnl: () => json({ actions: [mine, logmine] }) })
    const message = mineResultMessage(TX)
    await vi.advanceTimersByTimeAsync(1500)
    expect(await message).toBe('You mined 1.2345 TLM & 2.5 Shards')
  })

  it('gives up with a plain success message after about 20 seconds at most', async () => {
    nodes({ eosdac: hang, waxsweden: hang, detroitledger: hang, sentnl: hang })
    let settled = false
    const message = mineResultMessage(TX).finally(() => (settled = true))
    await vi.advanceTimersByTimeAsync(19_500)
    expect(settled).toBe(true)
    expect(await message).toBe('Mine successful')
  })

  it('does not look anything up without a transaction id', async () => {
    const calls = nodes({})
    expect(await mineResultMessage('')).toBe('Mine successful')
    expect(calls).toHaveLength(0)
  })
})
