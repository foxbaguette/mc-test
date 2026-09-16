import { ATOMIC_NODES } from './config'

/*
 * AtomicAssets client: same rotation/failover idea as the chain client, but
 * plain GETs. A node that fails is benched for a minute.
 */

type Params = Record<string, string | number | undefined>

const REQUEST_TIMEOUT_MS = 8000
const PENALTY_MS = 60_000

const penalties = new Map<string, number>()
let cursor = 0

function nodesInOrder(): string[] {
  const now = Date.now()
  const healthy = ATOMIC_NODES.filter((u) => (penalties.get(u) ?? 0) < now)
  const pool = healthy.length ? healthy : [...ATOMIC_NODES]
  const start = cursor++ % pool.length
  return [...pool.slice(start), ...pool.slice(0, start)]
}

function toQuery(params: Params): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const s = query.toString()
  return s ? `?${s}` : ''
}

async function getFrom<T>(base: string, path: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(base + path, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (json?.success === false) throw new Error(json?.message ?? 'Atomic API error')
    return json.data as T
  } catch (err) {
    penalties.set(base, Date.now() + PENALTY_MS)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function get<T>(path: string): Promise<T> {
  const errors: string[] = []
  for (const base of nodesInOrder()) {
    try {
      return await getFrom<T>(base, path)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }
  throw new Error(`AtomicAssets request failed: ${errors.join('; ')}`)
}

/**
 * For per-user lists where an empty answer would be read as "you own nothing":
 * a lagging node answers empty rather than failing, so ask the next node before
 * believing it.
 */
async function getNonEmpty<T>(path: string): Promise<T[]> {
  let last: T[] = []
  for (const base of nodesInOrder()) {
    try {
      last = await getFrom<T[]>(base, path)
      if (last.length > 0) return last
    } catch {
      /* A node that cannot answer is not a node saying no. */
    }
  }
  return last
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AtomicAsset<D = Record<string, any>> = {
  asset_id: string
  owner: string
  data: D
  template: { template_id: string } | null
}

export const atomic = {
  getAssets: <D>(params: Params) => get<AtomicAsset<D>[]>(`/atomicassets/v1/assets${toQuery(params)}`),

  getAsset: <D>(id: string) => get<AtomicAsset<D>>(`/atomicassets/v1/assets/${id}`),

  getTemplates: <T>(params: Params) => get<T[]>(`/atomicassets/v1/templates${toQuery(params)}`),

  /** Assets by id, batched into one request per 100 ids. */
  async getAssetsByIds<D>(ids: string[]): Promise<AtomicAsset<D>[]> {
    const unique = [...new Set(ids.filter((id) => id && id !== '0'))]
    const out: AtomicAsset<D>[] = []
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100)
      out.push(
        ...(await getNonEmpty<AtomicAsset<D>>(`/atomicassets/v1/assets${toQuery({ ids: chunk.join(','), limit: chunk.length })}`))
      )
    }
    return out
  },

  /** Every asset a wallet holds for the filter, paged. */
  async getOwnedAssets<D>(params: Params & { owner: string }): Promise<AtomicAsset<D>[]> {
    const out: AtomicAsset<D>[] = []
    for (let page = 1; page <= 20; page++) {
      const path = `/atomicassets/v1/assets${toQuery({ ...params, limit: 1000, page })}`
      const batch = page === 1 ? await getNonEmpty<AtomicAsset<D>>(path) : await get<AtomicAsset<D>[]>(path)
      out.push(...batch)
      if (batch.length < 1000) break
    }
    return out
  }
}
