import { afterEach, describe, expect, it, vi } from 'vitest'

import { EndpointPool } from './endpoints'

const healthy = () => Response.json({ head_block_time: new Date().toISOString().slice(0, -1) })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('EndpointPool', () => {
  it('ranks the nodes that answer, fastest first, and skips the ones that do not', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.startsWith('https://down')) throw new Error('offline')
        if (url.startsWith('https://slow')) await new Promise((r) => setTimeout(r, 30))
        return healthy()
      })
    )
    const pool = new EndpointPool(['https://slow', 'https://down', 'https://fast'])
    const status = await pool.probe()
    expect(status.healthy.map((h) => h.url)).toEqual(['https://fast', 'https://slow'])
    expect(pool.failoverOrder(3)).not.toContain('https://down')
  })

  it('benches a failing node and rotates to the next one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => healthy())
    )
    const pool = new EndpointPool(['https://a', 'https://b'])
    await pool.probe()
    const first = pool.next()
    pool.penalize(first)
    expect(pool.next()).not.toBe(first)
    expect(pool.next()).not.toBe(first)
  })

  it('probes again when every node is benched, but at most every 30 s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-09-18T12:00:00Z'))
    const fetchMock = vi.fn(async () => healthy())
    vi.stubGlobal('fetch', fetchMock)
    const pool = new EndpointPool(['https://a', 'https://b'])
    await pool.probe()
    const probes = () => fetchMock.mock.calls.length / 2 // two nodes per probe

    // Offline: rounds of failed reads on both nodes, each after the previous probe has finished.
    const failRound = async () => {
      pool.penalize('https://a')
      pool.penalize('https://b')
      await vi.waitFor(() => expect(pool.status().state).toBe('ready'))
    }
    for (let i = 0; i < 3; i++) await failRound()
    expect(probes()).toBe(2) // the first probe, plus a single forced one

    vi.setSystemTime(Date.parse('2026-09-18T12:00:31Z'))
    pool.penalize('https://a')
    pool.penalize('https://b')
    await vi.waitFor(() => expect(probes()).toBe(3))
  })
})
