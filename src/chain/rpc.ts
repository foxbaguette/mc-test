import { CORS_SAFE_CONTENT_TYPE } from './config'
import { endpointPool } from './endpoints'

/*
 * Chain reads on top of the endpoint pool:
 * - the pool picks the node (fastest few, round-robin, failed ones benched);
 * - a per-node token bucket (3 calls per 3 s) keeps any one node from being hammered;
 * - identical concurrent reads share one request;
 * - WAX nodes under load answer with an empty `rows` array rather than an error,
 *   so per-user reads can ask a different node before trusting "nothing there".
 */

const BUCKET_SIZE = 3
const BUCKET_WINDOW_MS = 3000
const REQUEST_TIMEOUT_MS = 8000

const calls = new Map<string, number[]>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function throttle(url: string) {
  for (;;) {
    const now = Date.now()
    const recent = (calls.get(url) ?? []).filter((t) => now - t < BUCKET_WINDOW_MS)
    if (recent.length < BUCKET_SIZE) {
      recent.push(now)
      calls.set(url, recent)
      return
    }
    calls.set(url, recent)
    await sleep(BUCKET_WINDOW_MS - (now - recent[0]) + 10)
  }
}

export class ChainError extends Error {
  constructor(
    message: string,
    readonly attempts: { url: string; error: string }[] = []
  ) {
    super(message)
    this.name = 'ChainError'
  }
}

interface Answer<T> {
  data: T
  url: string
}

async function post<T>(path: string, body: unknown, exclude?: Set<string>): Promise<Answer<T>> {
  const urls = endpointPool.failoverOrder(3, exclude)
  const attempts: { url: string; error: string }[] = []

  for (const url of urls) {
    await throttle(url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url + path, {
        method: 'POST',
        headers: { 'Content-Type': CORS_SAFE_CONTENT_TYPE },
        body: JSON.stringify(body),
        signal: controller.signal
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message = json?.error?.details?.[0]?.message ?? json?.message ?? `HTTP ${res.status}`
        // A 4xx other than rate limiting means the request is wrong; another node won't help.
        if (res.status < 500 && res.status !== 429) throw new ChainError(message, attempts)
        throw new Error(message)
      }
      return { data: json as T, url }
    } catch (err) {
      if (err instanceof ChainError) throw err
      attempts.push({ url, error: err instanceof Error ? err.message : String(err) })
      endpointPool.penalize(url)
    } finally {
      clearTimeout(timer)
    }
  }

  throw new ChainError(`All ${urls.length} endpoints failed for ${path}`, attempts)
}

export async function chainCall<T>(path: string, body: unknown): Promise<T> {
  return (await post<T>(path, body)).data
}

export interface TableQuery {
  code: string
  table: string
  scope?: string
  lower_bound?: string | number
  upper_bound?: string | number
  index_position?: number | string
  key_type?: string
  limit?: number
  reverse?: boolean
}

interface TableResult<T> {
  rows: T[]
  more: boolean
  next_key?: string
}

export interface ReadOptions {
  /** Re-check an empty result on a different node before trusting it. */
  confirmEmpty?: boolean
}

const inflight = new Map<string, Promise<unknown>>()

function shared<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const request = run().finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

export function getRows<T>(query: TableQuery, options: ReadOptions = {}): Promise<T[]> {
  const body = { json: true, scope: query.code, limit: 1000, ...query }
  const key = JSON.stringify(body) + (options.confirmEmpty ? '!' : '')

  return shared(key, async () => {
    const first = await post<TableResult<T>>('/v1/chain/get_table_rows', body)
    if (first.data.rows.length > 0 || !options.confirmEmpty) return first.data.rows

    const second = await post<TableResult<T>>('/v1/chain/get_table_rows', body, new Set([first.url]))
    return second.data.rows
  })
}

export async function getRow<T>(query: TableQuery, options: ReadOptions = {}): Promise<T | null> {
  const rows = await getRows<T>({ limit: 1, ...query }, options)
  return rows[0] ?? null
}

/** A whole table, following `next_key` pagination. */
export function getAllRows<T>(query: TableQuery): Promise<T[]> {
  const key = `all:${JSON.stringify(query)}`
  return shared(key, async () => {
    const out: T[] = []
    let lower = query.lower_bound
    // Guard against a malformed next_key looping forever.
    for (let page = 0; page < 50; page++) {
      const { data } = await post<TableResult<T>>('/v1/chain/get_table_rows', {
        json: true,
        scope: query.code,
        limit: 1000,
        ...query,
        lower_bound: lower
      })
      out.push(...data.rows)
      if (!data.more || !data.next_key) break
      lower = data.next_key
    }
    return out
  })
}
