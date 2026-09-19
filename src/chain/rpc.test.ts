import { afterEach, describe, expect, it, vi } from 'vitest'

import { getRow, getRows } from './rpc'

interface Body {
  table: string
  limit: number
  lower_bound?: number
  upper_bound?: number
  reverse?: boolean
  index_position?: number
}

/** A fake node holding ids 1..size, paging like nodeos: at most `limit` rows plus `more`/`next_key`. */
function serveTable(size: number, emptyFirst = false) {
  const requests: Body[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as Body
      requests.push(body)
      if (emptyFirst && requests.length === 1) return Response.json({ rows: [], more: false })

      const ids = Array.from({ length: size }, (_, i) => i + 1)
        .filter((id) => id >= (body.lower_bound ?? 1) && id <= (body.upper_bound ?? size))
        .sort((a, b) => (body.reverse ? b - a : a - b))
      const page = ids.slice(0, body.limit)
      const rest = ids.slice(body.limit)
      return Response.json({ rows: page.map((id) => ({ id })), more: rest.length > 0, next_key: rest[0] })
    })
  )
  return requests
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getRows', () => {
  it('follows next_key to the end of a table larger than one page', async () => {
    const requests = serveTable(2500)
    const rows = await getRows<{ id: number }>({ code: 'test', table: 'forward' })
    expect(rows).toHaveLength(2500)
    expect(rows.at(-1)).toEqual({ id: 2500 })
    expect(requests.map((r) => r.lower_bound)).toEqual([undefined, 1001, 2001])
  })

  it('pages a reverse read downwards through upper_bound', async () => {
    const requests = serveTable(1500)
    const rows = await getRows<{ id: number }>({ code: 'test', table: 'reverse', reverse: true })
    expect(rows).toHaveLength(1500)
    expect(rows[0]).toEqual({ id: 1500 })
    expect(rows.at(-1)).toEqual({ id: 1 })
    expect(requests.map((r) => r.upper_bound)).toEqual([undefined, 500])
  })

  it('keeps an explicit limit to one page', async () => {
    const requests = serveTable(2500)
    const rows = await getRows({ code: 'test', table: 'limited', limit: 100 })
    expect(rows).toHaveLength(100)
    expect(requests).toHaveLength(1)
    expect(await getRow({ code: 'test', table: 'single' })).toEqual({ id: 1 })
  })

  it('reports a cut-off secondary-index read instead of paging it', async () => {
    const requests = serveTable(1200)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const rows = await getRows({ code: 'test', table: 'indexed', index_position: 2 })
    expect(rows).toHaveLength(1000)
    expect(requests).toHaveLength(1)
    expect(warn).toHaveBeenCalledOnce()
  })

  it('moves to the next node when one fails or is rate limited', async () => {
    const answers = [
      () => new Response('down', { status: 503 }),
      () => Response.json({ message: 'slow down' }, { status: 429 }),
      () => Response.json({ rows: [{ id: 1 }], more: false })
    ]
    const reads: string[] = []
    // A node pool that finds nothing healthy probes again; those health checks are answered separately.
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/get_info')) return Response.json({ head_block_time: new Date().toISOString().slice(0, -1) })
      reads.push(url)
      return answers.shift()!()
    })
    vi.stubGlobal('fetch', fetchMock)
    expect(await getRows({ code: 'test', table: 'failover' })).toEqual([{ id: 1 }])
    expect(reads).toHaveLength(3)
    expect(new Set(reads).size).toBe(3)
  })

  it('stops at a request the chain rejects, since another node would reject it too', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { details: [{ message: 'unknown table' }] } }, { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getRows({ code: 'test', table: 'rejected' })).rejects.toThrow('unknown table')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports every node it tried when all fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 502 }))
    )
    await expect(getRows({ code: 'test', table: 'alldown' })).rejects.toThrow(/All 3 endpoints failed/)
  })

  it('asks a second node before trusting an empty answer', async () => {
    const requests = serveTable(3, true)
    const rows = await getRows({ code: 'test', table: 'confirm' }, { confirmEmpty: true })
    expect(rows).toHaveLength(3)
    expect(requests).toHaveLength(2)
  })
})
